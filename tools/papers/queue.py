#!/usr/bin/env python3
"""Private, resumable paper-publication queue. No credentials or network calls.

The native worker claims one step, performs it using authorized connected tools,
and records the result. This module NEVER infers permission or executes tools.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import secrets
import sqlite3
import time

STEPS = ('archive', 'upload', 'public_access', 'public_playback', 'catalog', 'deploy', 'live')
MUTATIONS = {'archive', 'upload', 'public_access', 'catalog'}
GATES = ('script_evidence', 'rights_and_credits', 'anna_voice', 'media_decode',
         'audio_playback', 'subtitle_sync', 'phone_figure_legibility', 'desktop_figure_legibility')
REPO = 'alxdofficial/alxdofficial.github.io'
SITE = 'https://alxdofficial.github.io/papers/'
SHA256 = re.compile(r'^[a-f0-9]{64}$')
SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
SHA = re.compile(r'^[a-f0-9]{40}$')

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def nonempty(obj, keys):
    if any(not isinstance(obj.get(k), str) or not obj[k].strip() for k in keys):
        raise ValueError('Missing receipt fields: ' + ', '.join(keys))

def check_job(job):
    if not SLUG.fullmatch(job.get('id', '')):
        raise ValueError('Invalid stable episode id')
    if job.get('repo') != REPO or job.get('site') != SITE:
        raise ValueError('Destination is outside this workflow')
    nonempty(job, ('paper_id', 'paper_version', 'production_date', 'archive_folder_id',
                   'presentation_folder_id', 'media_path', 'transcript_path', 'thumbnail_path', 'catalog_record_path',
                   'authorization_reference', 'qa_evidence_reference'))
    import datetime
    datetime.date.fromisoformat(job['production_date'])
    for name in ('media_sha256', 'transcript_sha256', 'thumbnail_sha256'):
        if not SHA256.fullmatch(job.get(name, '')):
            raise ValueError('Invalid ' + name)
    if not all(job.get('qa', {}).get(gate) is True for gate in GATES):
        raise ValueError('All scientific, rights, media and visual QA gates are required')
    if job.get('explanation_seconds', 0) <= 0 or job['explanation_seconds'] > 300:
        raise ValueError('Explanation must be over zero and at most 300 seconds')
    if not isinstance(job.get('demo_seconds', 0), (int, float)) or job.get('demo_seconds', 0) < 0:
        raise ValueError('Invalid demo duration')
    # Voice/QA evidence is an attestation, not an automated claim that this script
    # performed scientific or visual review. No speech-transcription gate exists.

class Queue:
    def __init__(self, path, clock=time.time):
        self.path = Path(path).resolve()
        # The queue stores private local paths and archive identifiers. Never put
        # it anywhere in a Git working tree (including ignored directories).
        if any((p / '.git').is_file() or (p / '.git' / 'HEAD').is_file()
               for p in (self.path.parent, *self.path.parents)):
            raise ValueError('Queue state must be outside every Git working tree')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.clock = clock
        self.db = sqlite3.connect(str(self.path), timeout=15, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS episodes (
          id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, manifest TEXT NOT NULL,
          created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS steps (
          episode TEXT NOT NULL REFERENCES episodes(id), position INTEGER NOT NULL,
          name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
          available REAL NOT NULL DEFAULT 0, token TEXT, lease_until REAL,
          receipt TEXT, error TEXT, checkpointed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (episode, name));
        CREATE TABLE IF NOT EXISTS intake (
          id TEXT PRIMARY KEY, record TEXT NOT NULL, status TEXT NOT NULL, updated REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, episode TEXT NOT NULL,
          step TEXT NOT NULL, at REAL NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL);
        ''')
        if 'checkpointed' not in {row[1] for row in self.db.execute('PRAGMA table_info(steps)')}:
            self.db.execute('ALTER TABLE steps ADD COLUMN checkpointed INTEGER NOT NULL DEFAULT 0')

    def close(self):
        self.db.close()

    def event(self, episode, step, kind, detail):
        self.db.execute('INSERT INTO events(episode,step,at,kind,detail) VALUES(?,?,?,?,?)',
                        (episode, step, self.clock(), kind, canonical(detail)))

    def add(self, job):
        check_job(job)
        manifest = canonical(job)
        fingerprint = hashlib.sha256(manifest.encode()).hexdigest()
        self.db.execute('BEGIN IMMEDIATE')
        try:
            intake = self.db.execute('SELECT record FROM intake WHERE id=?',(job['id'],)).fetchone()
            if intake and json.loads(intake[0])['paper_id'] != job['paper_id']:
                raise ValueError('Ready manifest must match the registered paper identity')
            previous = self.db.execute('SELECT fingerprint FROM episodes WHERE id=?', (job['id'],)).fetchone()
            if previous:
                if previous['fingerprint'] != fingerprint:
                    raise ValueError('Episode id already exists with different content; reconcile revision explicitly')
                self.db.commit()
                return False
            self.db.execute('INSERT INTO episodes VALUES(?,?,?,?)',
                            (job['id'], fingerprint, manifest, self.clock()))
            for i, step in enumerate(STEPS):
                self.db.execute('INSERT INTO steps(episode,position,name) VALUES(?,?,?)', (job['id'], i, step))
            self.db.execute("UPDATE intake SET status='promoted',updated=? WHERE id=?",(self.clock(),job['id']))
            self.event(job['id'], 'enqueue', 'added', {'fingerprint': fingerprint})
            self.db.commit()
            return True
        except BaseException:
            self.db.rollback()
            raise

    def register(self, record):
        """Track an unfinished real episode without asserting QA or executing it."""
        if not SLUG.fullmatch(record.get('id','')):
            raise ValueError('Invalid stable episode id')
        nonempty(record,('paper_id','source_reference','reason'))
        self.db.execute('BEGIN IMMEDIATE')
        try:
            if self.db.execute('SELECT 1 FROM episodes WHERE id=?',(record['id'],)).fetchone():
                self.db.commit();return False
            old=self.db.execute('SELECT record FROM intake WHERE id=?',(record['id'],)).fetchone()
            if old and json.loads(old[0])['paper_id'] != record['paper_id']:
                raise ValueError('Intake identity conflict')
            self.db.execute('INSERT INTO intake VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record,updated=excluded.updated',
                            (record['id'],canonical(record),'awaiting_readiness',self.clock()))
            self.event(record['id'],'readiness','registered',{'reason':record['reason']})
            self.db.commit();return True
        except BaseException:
            self.db.rollback();raise

    def intake(self):
        return [json.loads(r['record']) | {'status':r['status']} for r in self.db.execute("SELECT record,status FROM intake WHERE status!='promoted' ORDER BY id")]

    def claim(self, lease_seconds=900):
        if not 1 <= lease_seconds <= 3600:
            raise ValueError('Lease must be 1..3600 seconds')
        now = self.clock()
        self.db.execute('BEGIN IMMEDIATE')
        try:
            for row in self.db.execute("SELECT * FROM steps WHERE status='running' AND lease_until<=?", (now,)).fetchall():
                state = 'uncertain' if row['name'] in MUTATIONS else ('retry_exhausted' if row['attempts'] >= 6 else 'pending')
                self.db.execute('UPDATE steps SET status=?,available=?,token=NULL,lease_until=NULL WHERE episode=? AND name=?',
                                (state, now + min(21600, 60 * 2 ** min(row['attempts'] - 1, 8)), row['episode'], row['name']))
                self.event(row['episode'], row['name'], 'lease_expired', {'status': state})
            row = self.db.execute('''SELECT s.*,e.manifest,e.fingerprint FROM steps s
              JOIN episodes e ON e.id=s.episode WHERE s.status='pending' AND s.available<=?
              AND NOT EXISTS (SELECT 1 FROM steps p WHERE p.episode=s.episode
                  AND p.position<s.position AND p.status!='done')
              AND (s.name!='catalog' OR NOT EXISTS
                  (SELECT 1 FROM steps other WHERE other.name='catalog' AND (other.status IN ('running','uncertain')
                    OR (other.status='done' AND EXISTS (SELECT 1 FROM steps l
                       WHERE l.episode=other.episode AND l.name='live' AND l.status!='done')))))
              ORDER BY s.available,e.created,s.episode,s.position LIMIT 1''', (now,)).fetchone()
            if not row:
                self.db.commit()
                return None
            token = secrets.token_hex(16)
            self.db.execute('''UPDATE steps SET status='running',attempts=attempts+1,checkpointed=0,token=?,lease_until=?
                WHERE episode=? AND name=?''', (token, now + lease_seconds, row['episode'], row['name']))
            self.event(row['episode'], row['name'], 'claimed', {'attempt': row['attempts'] + 1})
            receipts = {r['name']: json.loads(r['receipt']) for r in self.db.execute(
                "SELECT name,receipt FROM steps WHERE episode=? AND status='done'", (row['episode'],))}
            self.db.commit()
            return {'episode': row['episode'], 'step': row['name'], 'lease_token': token,
                    'lease_until': now + lease_seconds, 'attempt': row['attempts'] + 1,
                    'idempotency_key': row['fingerprint'] + ':' + row['name'],
                    'manifest': json.loads(row['manifest']), 'receipts': receipts,
                    'requires_durable_checkpoint_before_execution': row['name'] in MUTATIONS}
        except BaseException:
            self.db.rollback()
            raise

    def _claimed(self, episode, step, token):
        row = self.db.execute('SELECT * FROM steps WHERE episode=? AND name=?', (episode, step)).fetchone()
        if not row or row['status'] != 'running' or row['token'] != token or row['lease_until'] <= self.clock():
            raise ValueError('Missing, stale or expired lease; reconcile before retrying')
        return row

    def _validate_receipt(self, episode, step, receipt):
        nonempty(receipt, ('evidence_reference',))
        job = json.loads(self.db.execute('SELECT manifest FROM episodes WHERE id=?', (episode,)).fetchone()[0])
        def prior(name):
            r = self.db.execute("SELECT receipt FROM steps WHERE episode=? AND name=? AND status='done'", (episode, name)).fetchone()
            if not r:
                raise ValueError('Prerequisite receipt missing: ' + name)
            return json.loads(r[0])
        if step == 'archive':
            nonempty(receipt, ('archive_file_id',))
        if step == 'upload':
            if job.get('existing_media_file_id') and receipt.get('file_id') != job['existing_media_file_id']:
                raise ValueError('Existing media identity must be preserved')
            nonempty(receipt, ('file_id', 'media_sha256'))
            if receipt['media_sha256'] != job['media_sha256']:
                raise ValueError('Uploaded bytes do not match approved media')
        if step in ('public_access', 'public_playback'):
            if receipt.get('file_id') != prior('upload')['file_id']:
                raise ValueError('Receipt is for a different media file')
        if step == 'public_access' and receipt.get('permission') != 'anyone:reader':
            raise ValueError('Specific finished video must have public viewer access')
        if step == 'public_playback':
            expected_src = 'https://drive.google.com/file/d/' + prior('upload')['file_id'] + '/preview'
            if not (receipt.get('playback_context') == 'site_iframe' and receipt.get('iframe_src') == expected_src and receipt.get('time_advanced') is True):
                raise ValueError('Actual site-iframe playback is required; direct Drive pages, metadata and mocks do not suffice')
        if step == 'catalog':
            if any(receipt.get(k) != job[k] for k in ('media_sha256','transcript_sha256','thumbnail_sha256')):
                raise ValueError('Catalog receipt must bind the approved artifact hashes')
            if not SHA.fullmatch(receipt.get('commit_sha', '')):
                raise ValueError('Catalog receipt needs the exact published commit')
            if receipt.get('repo') != REPO or receipt.get('file_id') != prior('upload')['file_id']:
                raise ValueError('Catalog receipt destination/media mismatch')
            if receipt.get('checks_passed') is not True:
                raise ValueError('Documented validation checks must pass before publication')
        if step == 'deploy':
            nonempty(receipt, ('workflow_run_id',))
            if receipt.get('workflow_path') != '.github/workflows/pages-deploy.yml' or receipt.get('environment') != 'github-pages':
                raise ValueError('Wrong deployment workflow or environment')
            if receipt.get('commit_sha') != prior('catalog')['commit_sha'] or receipt.get('conclusion') != 'success':
                raise ValueError('Deployment must succeed for the exact catalog commit')
        if step == 'live':
            if receipt.get('commit_sha') != prior('catalog')['commit_sha'] or receipt.get('file_id') != prior('upload')['file_id']:
                raise ValueError('Live version mismatch')
            if receipt.get('url') != SITE + episode + '/':
                raise ValueError('Live URL mismatch')
            if not all(receipt.get(k) is True for k in ('playback', 'transcript', 'paper_link', 'download', 'mobile', 'desktop')):
                raise ValueError('All live checks are required')

    def acknowledge_checkpoint(self, episode, step, token, snapshot_path, archive_file_id, evidence_reference):
        """Native worker calls after upload/read-back of the exact in-flight snapshot."""
        nonempty({'archive_file_id': archive_file_id, 'evidence_reference': evidence_reference},
                 ('archive_file_id', 'evidence_reference'))
        snapshot = Path(snapshot_path).resolve()
        if snapshot == self.path or not snapshot.is_file():
            raise ValueError('A separate verified snapshot is required')
        snap = sqlite3.connect('file:' + str(snapshot) + '?mode=ro', uri=True)
        try:
            row = snap.execute('SELECT status,token FROM steps WHERE episode=? AND name=?', (episode,step)).fetchone()
            if not row or row != ('running', token):
                raise ValueError('Snapshot does not contain this exact in-flight operation')
        finally:
            snap.close()
        digest = hashlib.sha256(snapshot.read_bytes()).hexdigest()
        self.db.execute('BEGIN IMMEDIATE')
        try:
            self._claimed(episode,step,token)
            self.db.execute('UPDATE steps SET checkpointed=1 WHERE episode=? AND name=?', (episode,step))
            self.event(episode,step,'checkpoint_saved', {'archive_file_id': archive_file_id,
                       'snapshot_sha256': digest, 'evidence_reference': evidence_reference})
            self.db.commit()
        except BaseException:
            self.db.rollback()
            raise
        return {'checkpoint_acknowledged': True, 'snapshot_sha256': digest}

    def finish(self, episode, step, token, receipt):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            claimed = self._claimed(episode, step, token)
            if step in MUTATIONS and not claimed['checkpointed']:
                raise ValueError('Persist and acknowledge the in-flight checkpoint before mutation')
            self._validate_receipt(episode, step, receipt)
            self.db.execute("UPDATE steps SET status='done',receipt=?,token=NULL,lease_until=NULL,error=NULL WHERE episode=? AND name=?",
                            (canonical(receipt), episode, step))
            self.event(episode, step, 'done', receipt)
            self.db.commit()
        except BaseException:
            self.db.rollback()
            raise

    def fail(self, episode, step, token, category, detail, known_not_executed=False):
        allowed = {'transient', 'denied', 'auth_required', 'quality_failed', 'uncertain'}
        if category not in allowed or not detail.strip():
            raise ValueError('Exact error category and detail are required')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row = self._claimed(episode, step, token)
            state = category
            delay = 0
            if category == 'transient':
                if step in MUTATIONS and not known_not_executed:
                    state = 'uncertain'
                elif row['attempts'] < 6:
                    state = 'pending'
                    delay = min(21600, 60 * 2 ** (row['attempts'] - 1))
                else:
                    state = 'retry_exhausted'
            self.db.execute('UPDATE steps SET status=?,available=?,error=?,token=NULL,lease_until=NULL WHERE episode=? AND name=?',
                            (state, self.clock() + delay, detail, episode, step))
            self.event(episode, step, 'failed', {'category': state, 'detail': detail, 'known_not_executed': known_not_executed})
            self.db.commit()
            return state
        except BaseException:
            self.db.rollback()
            raise

    def reconcile(self, episode, step, outcome, evidence_reference, receipt=None, previous_attempt_terminated=False):
        """Resolve uncertain effects only after a real read, never after silence."""
        nonempty({'evidence_reference': evidence_reference}, ('evidence_reference',))
        if outcome not in ('exists', 'absent'):
            raise ValueError('Outcome must be exists or absent')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row = self.db.execute('SELECT status,attempts FROM steps WHERE episode=? AND name=?', (episode, step)).fetchone()
            if not row or row['status'] != 'uncertain':
                raise ValueError('Only uncertain effects can be reconciled; denials require explicit new authorization')
            if outcome == 'exists':
                self._validate_receipt(episode, step, receipt or {})
                self.db.execute("UPDATE steps SET status='done',receipt=?,error=NULL WHERE episode=? AND name=?",
                                (canonical(receipt), episode, step))
            else:
                if not previous_attempt_terminated:
                    raise ValueError('Negative read alone is insufficient; verify the earlier worker/request terminated')
                state = 'retry_exhausted' if row['attempts'] >= 6 else 'pending'
                self.db.execute("UPDATE steps SET status=?,available=?,error=NULL WHERE episode=? AND name=?",
                                (state, self.clock() + min(21600,60 * 2 ** min(row['attempts'] - 1,8)), episode, step))
            self.event(episode, step, 'reconciled', {'outcome': outcome, 'evidence_reference': evidence_reference})
            self.db.commit()
        except BaseException:
            self.db.rollback()
            raise

    def snapshot(self, path):
        """Create a consistent private checkpoint for an existing archive upload."""
        target = Path(path).resolve()
        if target == self.path:
            raise ValueError('Snapshot must not replace the active database')
        if any((p / '.git').is_file() or (p / '.git' / 'HEAD').is_file()
               for p in (target.parent, *target.parents)):
            raise ValueError('Snapshot must stay outside Git working trees')
        target.parent.mkdir(parents=True, exist_ok=True)
        import tempfile
        with tempfile.NamedTemporaryFile(dir=target.parent, suffix='.sqlite', delete=False) as f:
            temporary = Path(f.name)
        try:
            dest = sqlite3.connect(str(temporary))
            try:
                self.db.backup(dest)
                result = dest.execute('PRAGMA integrity_check').fetchone()[0]
                generation = dest.execute('SELECT COALESCE(MAX(seq),0) FROM events').fetchone()[0]
                if result != 'ok':
                    raise ValueError('Snapshot integrity check failed')
            finally:
                dest.close()
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
        return {'path': str(target), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                'generation': generation}

    def renew(self, episode, step, token, lease_seconds=900):
        if not 1 <= lease_seconds <= 3600:
            raise ValueError('Lease must be 1..3600 seconds')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            self._claimed(episode,step,token)
            until=self.clock()+lease_seconds
            self.db.execute('UPDATE steps SET lease_until=? WHERE episode=? AND name=?',(until,episode,step))
            self.event(episode,step,'renewed',{'lease_until':until})
            self.db.commit()
            return {'lease_until':until}
        except BaseException:
            self.db.rollback();raise

    def resume(self, episode, step, evidence_reference, known_not_executed=False):
        """Audited recovery for repaired technical/setup failures, never denials."""
        nonempty({'evidence_reference':evidence_reference},('evidence_reference',))
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row=self.db.execute('SELECT status FROM steps WHERE episode=? AND name=?',(episode,step)).fetchone()
            if not row or row['status'] not in ('auth_required','retry_exhausted','quality_failed'):
                raise ValueError('Only repaired technical/setup failures may resume; denied and uncertain actions are excluded')
            if step in MUTATIONS and not known_not_executed:
                raise ValueError('Verify the earlier operation did not execute before resuming')
            self.db.execute("UPDATE steps SET status='pending',attempts=0,available=?,error=NULL,checkpointed=0 WHERE episode=? AND name=?",
                            (self.clock(),episode,step))
            self.event(episode,step,'resumed',{'evidence_reference':evidence_reference,'known_not_executed':known_not_executed})
            self.db.commit()
        except BaseException:
            self.db.rollback();raise

    def revise(self, job, evidence_reference):
        check_job(job);nonempty({'evidence_reference':evidence_reference},('evidence_reference',))
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row=self.db.execute('SELECT manifest,fingerprint FROM episodes WHERE id=?',(job['id'],)).fetchone()
            if not row:raise ValueError('No existing episode to revise')
            old=json.loads(row['manifest'])
            if any(old[k]!=job[k] for k in ('id','repo','site','paper_id','paper_version','production_date','archive_folder_id','presentation_folder_id')):
                raise ValueError('Revision cannot change identity, destinations or original production date')
            if self.db.execute("SELECT 1 FROM steps WHERE episode=? AND status IN ('running','uncertain','denied')",(job['id'],)).fetchone():
                raise ValueError('Resolve running/uncertain actions and actual denials before revision')
            upload=self.db.execute("SELECT receipt FROM steps WHERE episode=? AND name='upload' AND status='done'",(job['id'],)).fetchone()
            existing=json.loads(upload[0])['file_id'] if upload else old.get('existing_media_file_id')
            if existing and job.get('existing_media_file_id')!=existing:
                raise ValueError('Revision must explicitly preserve the existing media file id')
            value=canonical(job); fingerprint=hashlib.sha256(value.encode()).hexdigest()
            if fingerprint==row['fingerprint']:raise ValueError('Revision is unchanged; use technical resume if appropriate')
            self.db.execute('UPDATE episodes SET manifest=?,fingerprint=? WHERE id=?',(value,fingerprint,job['id']))
            self.db.execute("UPDATE steps SET status='pending',attempts=0,available=0,token=NULL,lease_until=NULL,receipt=NULL,error=NULL,checkpointed=0 WHERE episode=?",(job['id'],))
            self.event(job['id'],'revision','revised',{'old_fingerprint':row['fingerprint'],'new_fingerprint':fingerprint,'evidence_reference':evidence_reference})
            self.db.commit()
        except BaseException:
            self.db.rollback();raise

    def status(self):
        return [dict(r) for r in self.db.execute('''SELECT episode,name,status,attempts,available,error
            FROM steps ORDER BY episode,position''')]


def verify_files(job):
    check_job(job)
    for kind in ('media', 'transcript', 'thumbnail'):
        file = Path(job[kind + '_path'])
        if not file.is_absolute() or not file.is_file():
            raise ValueError('Missing executor-local asset: ' + kind)
        with file.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if digest != job[kind + '_sha256']:
            raise ValueError('Asset changed since QA: ' + kind)
    record = json.loads(Path(job['catalog_record_path']).read_text())
    if record.get('id') != job['id'] or record.get('published') != job['production_date']:
        raise ValueError('Catalog identity or original production date mismatch')
    return {'assets_match': True, 'episode': job['id']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, help='Private SQLite file outside any Git working tree')
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('add'); p.add_argument('manifest')
    p = sub.add_parser('claim'); p.add_argument('--lease-seconds', type=int, default=900)
    sub.add_parser('status')
    sub.add_parser('intake')
    p = sub.add_parser('register');p.add_argument('record')
    p = sub.add_parser('renew')
    for key in ('episode','step','token'): p.add_argument(key)
    p.add_argument('--lease-seconds',type=int,default=900)
    p = sub.add_parser('resume')
    for key in ('episode','step','evidence_reference'): p.add_argument(key)
    p.add_argument('--known-not-executed',action='store_true')
    p = sub.add_parser('revise');p.add_argument('manifest');p.add_argument('evidence_reference')
    p = sub.add_parser('ack-checkpoint')
    for key in ('episode','step','token','snapshot_path','archive_file_id','evidence_reference'): p.add_argument(key)
    p = sub.add_parser('snapshot'); p.add_argument('path')
    p = sub.add_parser('verify-files'); p.add_argument('manifest')
    for command in ('finish', 'fail'):
        p = sub.add_parser(command)
        for key in ('episode', 'step', 'token'):
            p.add_argument(key)
        if command == 'finish': p.add_argument('receipt')
        else:
            p.add_argument('category'); p.add_argument('detail'); p.add_argument('--known-not-executed', action='store_true')
    p = sub.add_parser('reconcile')
    for key in ('episode', 'step', 'outcome', 'evidence_reference'): p.add_argument(key)
    p.add_argument('--receipt')
    p.add_argument('--previous-attempt-terminated',action='store_true')
    args = parser.parse_args()
    q = Queue(args.db)
    try:
        read = lambda path: json.loads(Path(path).read_text())
        if args.command == 'add': result = {'added': q.add(read(args.manifest))}
        elif args.command == 'claim': result = q.claim(args.lease_seconds)
        elif args.command == 'status': result = q.status()
        elif args.command == 'intake': result = q.intake()
        elif args.command == 'register': result = q.register(read(args.record))
        elif args.command == 'renew': result = q.renew(args.episode,args.step,args.token,args.lease_seconds)
        elif args.command == 'resume': result = q.resume(args.episode,args.step,args.evidence_reference,args.known_not_executed)
        elif args.command == 'revise': result = q.revise(read(args.manifest),args.evidence_reference)
        elif args.command == 'ack-checkpoint': result = q.acknowledge_checkpoint(args.episode,args.step,args.token,args.snapshot_path,args.archive_file_id,args.evidence_reference)
        elif args.command == 'snapshot': result = q.snapshot(args.path)
        elif args.command == 'verify-files': result = verify_files(read(args.manifest))
        elif args.command == 'finish': result = q.finish(args.episode, args.step, args.token, read(args.receipt))
        elif args.command == 'fail': result = q.fail(args.episode, args.step, args.token, args.category, args.detail, args.known_not_executed)
        else: result = q.reconcile(args.episode, args.step, args.outcome, args.evidence_reference, read(args.receipt) if args.receipt else None,args.previous_attempt_terminated)
        print(json.dumps(result, indent=2))
    finally:
        q.close()
if __name__ == '__main__': main()
