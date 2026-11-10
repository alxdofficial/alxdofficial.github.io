import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('paper_queue', Path(__file__).with_name('queue.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.now = 1000
        self.path = Path(self.tmp.name) / 'state.sqlite'
        self.q = m.Queue(self.path, lambda: self.now)
        self.job = dict(id='paper-one', paper_id='2611.00001', paper_version='v1',
            production_date='2026-11-10', repo=m.REPO, site=m.SITE,
            archive_folder_id='private-folder', presentation_folder_id='presentation-folder',
            media_path='/private/final.mp4', transcript_path='/private/transcript.txt',
            thumbnail_path='/private/frame.jpg', catalog_record_path='/private/episode.json', media_sha256='a'*64, transcript_sha256='b'*64,
            thumbnail_sha256='c'*64, explanation_seconds=180, demo_seconds=0,
            authorization_reference='trusted task reference', qa_evidence_reference='private QA report',
            qa={k:True for k in m.GATES})
    def tearDown(self):
        self.q.close(); self.tmp.cleanup()
    def add(self, slug='paper-one'):
        j=copy.deepcopy(self.job); j['id']=slug; self.q.add(j)
    def receipt(self, step):
        r=dict(evidence_reference='verified private evidence')
        if step=='archive': r.update(archive_file_id='saved-archive')
        if step=='upload': r.update(file_id='public-media', media_sha256='a'*64)
        if step=='public_access': r.update(file_id='public-media', permission='anyone:reader')
        if step=='public_playback': r.update(file_id='public-media', playback_context='site_iframe', iframe_src='https://drive.google.com/file/d/public-media/preview', time_advanced=True)
        if step=='catalog': r.update(file_id='public-media', repo=m.REPO, commit_sha='d'*40, checks_passed=True,media_sha256='a'*64,transcript_sha256='b'*64,thumbnail_sha256='c'*64)
        if step=='deploy': r.update(commit_sha='d'*40, conclusion='success',workflow_run_id='123',workflow_path='.github/workflows/pages-deploy.yml',environment='github-pages')
        if step=='live': r.update(file_id='public-media', commit_sha='d'*40, url=m.SITE+'paper-one/',
            playback=True, transcript=True, paper_link=True, download=True, mobile=True, desktop=True)
        return r
    def done(self, claim, receipt=None):
        if claim['step'] in m.MUTATIONS:
            snapshot=Path(self.tmp.name)/'before-effect.sqlite'; self.q.snapshot(snapshot)
            self.q.acknowledge_checkpoint(claim['episode'],claim['step'],claim['lease_token'],snapshot,'test-private-checkpoint','test upload/read evidence')
        self.q.finish(claim['episode'],claim['step'],claim['lease_token'],receipt or self.receipt(claim['step']))
    def until(self, step):
        self.add()
        while True:
            c=self.q.claim()
            if c['step']==step: return c
            self.done(c)
    def test_complete_pipeline(self):
        self.add()
        for step in m.STEPS:
            c=self.q.claim(); self.assertEqual(c['step'],step); self.done(c)
        self.assertIsNone(self.q.claim())
        self.assertTrue(all(r['status']=='done' for r in self.q.status()))
    def test_duplicate_enqueue_is_noop(self):
        self.add(); self.assertFalse(self.q.add(self.job)); self.assertEqual(len(self.q.status()),7)
    def test_changed_duplicate_rejected(self):
        self.add(); self.job['media_sha256']='f'*64
        with self.assertRaises(ValueError):self.q.add(self.job)
    def test_destination_allowlist(self):
        self.job['repo']='someone/else'
        with self.assertRaises(ValueError):self.q.add(self.job)
    def test_qa_not_optional(self):
        del self.job['qa']['phone_figure_legibility']
        with self.assertRaises(ValueError):self.q.add(self.job)
    def test_long_explanation_rejected(self):
        self.job['explanation_seconds']=301
        with self.assertRaises(ValueError):self.q.add(self.job)
    def test_actual_git_worktree_rejected(self):
        d=Path(self.tmp.name)/'repo'; (d/'.git').mkdir(parents=True); (d/'.git'/'HEAD').write_text('ref: refs/heads/main')
        with self.assertRaises(ValueError):m.Queue(d/'queue.sqlite')
    def test_queue_survives_restart(self):
        self.add(); self.done(self.q.claim()); self.q.close()
        self.q=m.Queue(self.path,lambda:self.now)
        self.assertEqual(self.q.claim()['step'],'upload')
    def test_two_workers_cannot_claim_same_step(self):
        self.add(); q2=m.Queue(self.path,lambda:self.now)
        try:
            self.assertIsNotNone(self.q.claim()); self.assertIsNone(q2.claim())
        finally:q2.close()
    def test_expired_mutation_needs_reconcile(self):
        self.add(); self.q.claim(1); self.now+=2
        self.assertIsNone(self.q.claim()); self.assertEqual(self.q.status()[0]['status'],'uncertain')
    def test_readonly_expired_step_retries(self):
        c=self.until('public_playback'); self.now=c['lease_until']+1
        self.assertIsNone(self.q.claim());self.now+=60
        self.assertEqual(self.q.claim()['step'],'public_playback')
    def test_stale_worker_rejected(self):
        self.add(); c=self.q.claim(1); self.now+=2
        with self.assertRaises(ValueError):self.done(c)
    def test_bad_token_rejected(self):
        self.add(); c=self.q.claim(); c['lease_token']='wrong'
        with self.assertRaises(ValueError):self.done(c)
    def test_denied_episode_does_not_block_other(self):
        self.add(); self.add('paper-two'); c=self.q.claim()
        self.q.fail(c['episode'],c['step'],c['lease_token'],'denied','exact action denied',True)
        self.assertEqual(self.q.claim()['episode'],'paper-two')
    def test_denial_cannot_be_reconciled_as_absent(self):
        self.add(); c=self.q.claim(); self.q.fail(c['episode'],c['step'],c['lease_token'],'denied','denied',True)
        with self.assertRaises(ValueError):self.q.reconcile('paper-one','archive','absent','read evidence')
    def test_transient_mutation_uncertain_without_negative_proof(self):
        self.add(); c=self.q.claim()
        self.assertEqual(self.q.fail(c['episode'],c['step'],c['lease_token'],'transient','timeout'),'uncertain')
    def test_transient_known_not_executed_backoff(self):
        self.add(); c=self.q.claim()
        self.q.fail(c['episode'],c['step'],c['lease_token'],'transient','429 before execution',True)
        self.assertIsNone(self.q.claim()); self.now+=60; self.assertIsNotNone(self.q.claim())
    def test_uncertain_absent_retries_only_after_reconcile(self):
        self.add(); c=self.q.claim(); self.q.fail(c['episode'],c['step'],c['lease_token'],'uncertain','timeout')
        self.assertIsNone(self.q.claim()); self.q.reconcile('paper-one','archive','absent','negative provider lookup',previous_attempt_terminated=True)
        self.now+=60
        self.assertEqual(self.q.claim()['step'],'archive')
    def test_uncertain_exists_does_not_repeat_effect(self):
        self.add(); c=self.q.claim(); self.q.fail(c['episode'],c['step'],c['lease_token'],'uncertain','timeout')
        self.q.reconcile('paper-one','archive','exists','provider lookup',self.receipt('archive'))
        self.assertEqual(self.q.claim()['step'],'upload')
    def test_uploaded_hash_must_match(self):
        c=self.until('upload'); r=self.receipt('upload'); r['media_sha256']='f'*64
        with self.assertRaises(ValueError):self.done(c,r)
    def test_public_access_is_not_playback(self):
        c=self.until('public_playback'); r=self.receipt('public_playback'); r['time_advanced']=False
        with self.assertRaises(ValueError):self.done(c,r)
    def test_playback_wrong_file_rejected(self):
        c=self.until('public_playback'); r=self.receipt('public_playback'); r['file_id']='other'
        with self.assertRaises(ValueError):self.done(c,r)
    def test_catalog_requires_checks(self):
        c=self.until('catalog'); r=self.receipt('catalog'); r['checks_passed']=False
        with self.assertRaises(ValueError):self.done(c,r)
    def test_deploy_wrong_commit_rejected(self):
        c=self.until('deploy'); r=self.receipt('deploy'); r['commit_sha']='e'*40
        with self.assertRaises(ValueError):self.done(c,r)
    def test_live_wrong_url_rejected(self):
        c=self.until('live'); r=self.receipt('live'); r['url']=m.SITE+'other/'
        with self.assertRaises(ValueError):self.done(c,r)
    def test_failed_finish_retains_lease(self):
        c=self.until('upload')
        with self.assertRaises(ValueError):self.done(c,{'evidence_reference':'incomplete'})
        self.done(c); self.assertEqual(self.q.claim()['step'],'public_access')
    def test_retry_budget(self):
        self.add()
        for i in range(6):
            c=self.q.claim(); state=self.q.fail(c['episode'],c['step'],c['lease_token'],'transient','429',True); self.now+=22000
        self.assertEqual(state,'retry_exhausted'); self.assertIsNone(self.q.claim())
    def test_only_one_catalog_writer(self):
        c=self.until('catalog'); self.add('paper-two')
        # The first catalog lease stays active while another episode progresses.
        for step in m.STEPS[:4]:
            d=self.q.claim(); self.assertEqual(d['step'],step); self.done(d)
        self.assertIsNone(self.q.claim()); self.done(c)
        self.assertEqual(self.q.claim()['episode'],'paper-one') # deploy remains independently eligible
    def test_snapshot_restores_completed_steps(self):
        self.add(); self.done(self.q.claim())
        target=Path(self.tmp.name)/'snapshot.sqlite'; self.q.snapshot(target)
        q2=m.Queue(target,lambda:self.now)
        try:self.assertEqual(q2.claim()['step'],'upload')
        finally:q2.close()
    def test_snapshot_cannot_overwrite_live_database(self):
        with self.assertRaises(ValueError):self.q.snapshot(self.path)
    def test_verify_files_detects_changed_bytes(self):
        import hashlib,json
        for kind in ('media','transcript','thumbnail'):
            path=Path(self.tmp.name)/kind;path.write_bytes(b'original')
            self.job[kind+'_path']=str(path)
            self.job[kind+'_sha256']=hashlib.sha256(b'original').hexdigest()
        record=Path(self.tmp.name)/'record.json'
        record.write_text(json.dumps({'id':'paper-one','published':'2026-11-10'}))
        self.job['catalog_record_path']=str(record)
        self.assertTrue(m.verify_files(self.job)['assets_match'])
        Path(self.job['media_path']).write_bytes(b'changed')
        with self.assertRaises(ValueError):m.verify_files(self.job)
    def test_mutation_requires_inflight_checkpoint(self):
        self.add();c=self.q.claim()
        with self.assertRaises(ValueError):self.q.finish(c['episode'],c['step'],c['lease_token'],self.receipt(c['step']))
    def test_preclaim_checkpoint_cannot_authorize_mutation(self):
        self.add();path=Path(self.tmp.name)/'too-early.sqlite';self.q.snapshot(path);c=self.q.claim()
        with self.assertRaises(ValueError):self.q.acknowledge_checkpoint(c['episode'],c['step'],c['lease_token'],path,'file','evidence')
    def test_catalog_lock_extends_through_live_verification(self):
        c=self.until('catalog');self.done(c);self.add('paper-two')
        # Complete all eligible reads and second video's media stages, but hold live.
        while True:
            d=self.q.claim()
            if d['step']=='live':break
            self.done(d)
        for step in m.STEPS[:4]:
            e=self.q.claim();self.assertEqual(e['episode'],'paper-two');self.assertEqual(e['step'],step);self.done(e)
        self.assertIsNone(self.q.claim())
        self.done(d);self.assertEqual(self.q.claim()['step'],'catalog')
    def test_preserve_existing_media_id(self):
        self.job['existing_media_file_id']='original-media';c=self.until('upload')
        with self.assertRaises(ValueError):self.done(c)
    def test_absence_does_not_fence_old_request(self):
        self.add();c=self.q.claim(1);self.now+=2;self.q.claim()
        with self.assertRaises(ValueError):self.q.reconcile('paper-one','archive','absent','negative lookup')
    def test_lease_can_be_renewed(self):
        self.add();c=self.q.claim(10);self.now+=5;self.q.renew(c['episode'],c['step'],c['lease_token'],100)
        self.now+=10;self.done(c)
    def test_technical_resume_cannot_reset_denial(self):
        self.add();c=self.q.claim();self.q.fail(c['episode'],c['step'],c['lease_token'],'denied','actual denial',True)
        with self.assertRaises(ValueError):self.q.resume('paper-one','archive','new evidence',True)
    def test_repaired_login_can_resume(self):
        self.add();c=self.q.claim();self.q.fail(c['episode'],c['step'],c['lease_token'],'auth_required','login expired',True)
        self.q.resume('paper-one','archive','verified authorized login restored',True)
        self.assertEqual(self.q.claim()['step'],'archive')
    def test_revision_preserves_media_identity(self):
        c=self.until('public_playback');self.q.fail(c['episode'],c['step'],c['lease_token'],'quality_failed','bad host encode')
        j=copy.deepcopy(self.job);j['media_sha256']='f'*64
        with self.assertRaises(ValueError):self.q.revise(j,'new QA')
        j['existing_media_file_id']='public-media';self.q.revise(j,'new QA')
        self.assertEqual(self.q.claim()['step'],'archive')
    def test_unready_episode_is_registered_but_never_claimed(self):
        self.q.register({'id':'paper-one','paper_id':'2611.00001','source_reference':'saved QA','reason':'playback not yet observed'})
        self.assertEqual(len(self.q.intake()),1);self.assertIsNone(self.q.claim())
    def test_ready_enqueue_promotes_intake(self):
        self.q.register({'id':'paper-one','paper_id':'2611.00001','source_reference':'saved QA','reason':'playback pending'})
        self.add();self.assertEqual(self.q.intake(),[]);self.assertIsNotNone(self.q.claim())
    def test_intake_survives_private_checkpoint(self):
        self.q.register({'id':'paper-one','paper_id':'2611.00001','source_reference':'saved QA','reason':'playback pending'})
        p=Path(self.tmp.name)/'intake-snapshot.sqlite';self.q.snapshot(p);q2=m.Queue(p)
        try:self.assertEqual(q2.intake()[0]['id'],'paper-one')
        finally:q2.close()
    def test_direct_preview_is_not_embedded_playback_evidence(self):
        c=self.until('public_playback');r=self.receipt('public_playback');r['playback_context']='direct_drive_page'
        with self.assertRaises(ValueError):self.done(c,r)
    def test_no_speech_content_gate(self):
        self.assertFalse(any('whisper' in s or 'transcription' in s for s in m.GATES))

if __name__=='__main__':unittest.main()
