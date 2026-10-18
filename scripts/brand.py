from pathlib import Path
import cairosvg
p=Path(__file__).resolve().parents[1]/'public'/'brand'
mark='<path d="M9 15V7h27v30H9V23" fill="none" stroke="{ink}" stroke-width="3"/><path d="M17 43h27V15h-8" fill="none" stroke="{ink}" stroke-width="3"/><path d="M3 22h18l7 7h17" fill="none" stroke="{accent}" stroke-width="4"/><rect x="40" y="24" width="9" height="9" fill="{accent}"/>'
def symbol(ink,accent):return mark.format(ink=ink,accent=accent)
for name,ink,accent in [('dark','#25313B','#345BD4'),('light','#F2F5F7','#99B2FF')]:
 s=f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="130" viewBox="0 0 480 130"><g transform="translate(7 11) scale(2)">{symbol(ink,accent)}</g><text x="135" y="92" font-family="Arial,Helvetica,sans-serif" font-weight="500" font-size="85" letter-spacing="-4" fill="{ink}">Revwake</text></svg>'
 (p/f'revwake-{name}.svg').write_text(s)
 cairosvg.svg2png(bytestring=s.encode(),write_to=str(p/f'revwake-{name}.png'),output_width=1440,output_height=390)
 s=f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g transform="translate(6 5)">{symbol(ink,accent)}</g></svg>'
 (p/('symbol.svg' if name=='dark' else 'symbol-light.svg')).write_text(s)
 if name=='dark':cairosvg.svg2png(bytestring=s.encode(),write_to=str(p/'symbol.png'),output_width=512,output_height=512)
avatar=f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#F2F5F7"/><g transform="translate(105 90) scale(6)">{symbol("#25313B","#345BD4")}</g></svg>'
(p/'avatar.svg').write_text(avatar)
cairosvg.svg2png(bytestring=avatar.encode(),write_to=str(p/'avatar.png'))
favicon=f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#25313B"/><g transform="translate(10 9) scale(.88)">{symbol("#F2F5F7","#99B2FF")}</g></svg>'
(p/'favicon.svg').write_text(favicon)
for size,name in [(16,'favicon-16.png'),(32,'favicon-32.png'),(180,'apple-touch-icon.png')]:cairosvg.svg2png(bytestring=favicon.encode(),write_to=str(p/name),output_width=size,output_height=size)
social=f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#F2F5F7"/><path d="M65 175h1070M65 530h1070" stroke="#BECBD5"/><g transform="translate(70 60) scale(1.5)">{symbol("#25313B","#345BD4")}</g><text x="160" y="120" fill="#25313B" font-family="Arial" font-size="45">Revwake</text><text x="70" y="285" fill="#25313B" font-family="Arial" font-size="60">The specification changed.</text><text x="70" y="370" fill="#345BD4" font-family="Arial" font-size="58">Know what needs to</text><text x="70" y="440" fill="#345BD4" font-family="Arial" font-size="58">change with it.</text><text x="70" y="580" fill="#596B79" font-family="monospace" font-size="22">SPECIFICATION CHANGE REVIEWS / REVWAKE.SPACE</text></svg>'
cairosvg.svg2png(bytestring=social.encode(),write_to=str(p/'social-preview.png'))
