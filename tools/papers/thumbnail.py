#!/usr/bin/env python3
"""Compose an editorial thumbnail around an unchanged source figure.
Run from repository root: python3 tools/papers/thumbnail.py SLUG
Pillow is required. Never crops/resamples source labels independently or draws results.
"""
from pathlib import Path
import json,sys,textwrap
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]; PAPER=ROOT/'papers'
def font(name,size): return ImageFont.truetype(str(PAPER/'assets/fonts'/name),size)
def compose(e):
 source=PAPER/e['thumbnail_original_path']; im=Image.open(source).convert('RGB')
 out=Image.new('RGB',(1280,720),'#1e2224'); d=ImageDraw.Draw(out)
 d.rectangle((24,24,1256,696),fill='#151a1c')
 mono=font('JetBrainsMono-Regular.ttf',12); title=font('PlayfairDisplay.ttf',31)
 d.text((48,42),e['playlists'][0].upper()+' / '+e['published'],font=mono,fill='#a5e4d6')
 d.text((938,42),'PREPRINT · AUTHOR-REPORTED',font=mono,fill='#a9adb0')
 headline=e['headline']; lines=textwrap.wrap(headline,68)
 for i,line in enumerate(lines[:2]): d.text((48,72+38*i),line,font=title,fill='#fcfaf5')
 top=125 if len(lines)==1 else 160
 box=(48,top,1232,574); scale=min((box[2]-box[0])/im.width,(box[3]-box[1])/im.height); im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
 d.rectangle(box,fill='#23282a'); out.paste(im,(box[0]+(box[2]-box[0]-im.width)//2,box[1]+(box[3]-box[1]-im.height)//2))
 d.text((48,591),('ORIGINAL PAPER VISUAL · FRAMED FOR THE CHANNEL' if e.get('thumbnail_source_url') else 'EXPLANATORY ADAPTATION · NOT EXPERIMENTAL OUTPUT'),font=mono,fill='#a5e4d6')
 caption=e.get('thumbnail_figure') or e['short_title']
 for i,line in enumerate(textwrap.wrap(caption,95)[:2]): d.text((48,615+i*20),line,font=font('JetBrainsMono-Regular.ttf',16),fill='#fcfaf5')
 footer=e['paper_url'].split('/')[-1]+' · '+e.get('thumbnail_license','Source credits on watch page')+(' · Source pixels retained; layout adaptation' if e.get('thumbnail_source_url') else ' · Explanatory diagram; layout adaptation')
 d.text((48,670),footer,font=font('JetBrainsMono-Regular.ttf',11),fill='#a9adb0')
 d.line((48,691,288,691),fill='#a5e4d6',width=3)
 out.save(PAPER/e['thumbnail_path'],quality=94)
if __name__=='__main__':
 data=json.loads((PAPER/'episodes.json').read_text())
 for e in data['episodes']:
  if e['id'] in sys.argv[1:]: compose(e)
