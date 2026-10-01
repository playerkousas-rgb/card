import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, FileDown, ImagePlus, Layers, Minus, Paintbrush, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import './styles.css';

const CARD_SIZE = { w: 63, h: 88, label: '啤牌 / Poker 63×88mm' };

const templates = {
  poker52: { label: '標準啤牌 52 隻', count: 52, desc: '4 種花色 × A 至 K，可作普通啤牌遊玩。' },
  poker54: { label: '啤牌 54 隻', count: 54, desc: '52 隻標準啤牌 + 大小皇。' },
  uno108: { label: 'UNO 類型 108 隻', count: 108, desc: '顏色、數字、功能牌，可改成旅團任務版。' },
  custom: { label: '自訂數量', count: 12, desc: '給特別活動、章別訓練、任務卡使用。' },
};

const printSizes = {
  a4: { label: 'A4 家用打印', page: 'A4 portrait', w: 210, h: 297, desc: 'A4 排多張啤牌，可顯示剪裁虛線。' },
  r3: { label: '3R 相片 89×127mm', page: '89mm 127mm', w: 89, h: 127, desc: '一張 3R 放一張 63×88mm 啤牌，最接近相片沖印做法。' },
  r4: { label: '4R 相片 102×152mm', page: '102mm 152mm', w: 102, h: 152, desc: '一張 4R 放一張 63×88mm 啤牌，邊位較多，適合高質輸出。' },
};

const a4Choices = [1, 2, 4, 6, 8, 9, 12, 13, 16, 18, 25, 36, 52];

const backPatterns = [
  { id: 'scout', label: 'Scout 指南星' },
  { id: 'cloud', label: '雲紋' },
  { id: 'compass', label: '指南針' },
  { id: 'chevron', label: '童軍箭紋' },
  { id: 'plain', label: '淨色' },
  { id: 'custom', label: '自訂上傳圖案' },
];

const frontPatterns = [
  { id: 'classic', label: '經典啤牌角標' },
  { id: 'clouds', label: '雲 / 氣象' },
  { id: 'forest', label: '森林' },
  { id: 'stars', label: '星空' },
  { id: 'knots', label: '繩結' },
  { id: 'custom', label: '自訂上傳圖案' },
  { id: 'blank', label: '留白' },
];

const imageSlots = {
  none: { label: '不放圖案', help: '只有文字和花色。' },
  logoTL: { label: '左上 LOGO', help: '系統自動用 LOGO 尺寸，放在安全邊距內。' },
  logoTR: { label: '右上 LOGO', help: '系統自動用 LOGO 尺寸，放在安全邊距內。' },
  logoBL: { label: '左下 LOGO', help: '適合旅團章或活動章。' },
  logoBR: { label: '右下 LOGO', help: '適合旅團章或活動章。' },
  iconCenter: { label: '中間圖案', help: '中等尺寸，適合雲種、技能或章別圖示。' },
  heroCenter: { label: '中間大圖', help: '大圖尺寸，適合相片或主視覺。' },
  watermark: { label: '淡水印', help: '自動放大、降低透明度，作背景紋理。' },
};

const textLayouts = {
  standard: { label: '標準：標題 + 大字 + 說明' },
  playing: { label: '啤牌：只顯示大字 / 點數' },
  caption: { label: '圖片卡：文字放底部' },
  none: { label: '不放文字' },
};

const suitData = [
  { suit: '♠', name: 'Spade', color: 'black' },
  { suit: '♥', name: 'Heart', color: 'red' },
  { suit: '♦', name: 'Diamond', color: 'red' },
  { suit: '♣', name: 'Club', color: 'black' },
];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function pokerCards(includeJokers = false) {
  const cards = suitData.flatMap(s => ranks.map(rank => makeCard(`${rank}${s.suit}`, rank, s.suit, s.name, s.color)));
  if (includeJokers) {
    cards.push(makeCard('JK', 'JOKER', '大皇', 'Joker', 'red', '★'));
    cards.push(makeCard('JK', 'JOKER', '小皇', 'Joker', 'black', '☆'));
  }
  return cards;
}

function unoCards() {
  const colors = [['紅', '#dc2626'], ['黃', '#ca8a04'], ['綠', '#16a34a'], ['藍', '#2563eb']];
  const action = ['Skip', 'Reverse', '+2'];
  const cards = [];
  colors.forEach(([name, color]) => {
    cards.push(makeCard(`${name} 0`, '0', name, name, color));
    for (let i = 1; i <= 9; i++) { cards.push(makeCard(`${name} ${i}`, String(i), name, name, color)); cards.push(makeCard(`${name} ${i}`, String(i), name, name, color)); }
    action.forEach(a => { cards.push(makeCard(`${name} ${a}`, a, name, name, color)); cards.push(makeCard(`${name} ${a}`, a, name, name, color)); });
  });
  for (let i = 0; i < 4; i++) { cards.push(makeCard('Wild', 'WILD', '萬用牌', '萬用', '#111827')); cards.push(makeCard('+4', '+4', '萬用牌', '萬用', '#111827')); }
  return cards;
}

function customCards(count = 12) { return Array.from({ length: count }, (_, i) => makeCard(String(i + 1).padStart(2, '0'), `卡牌 ${i + 1}`, '自訂用途', '任務卡', 'black')); }
function makeCard(number, centerText, note, title = '卡牌', playColor = 'black', playSuit = '') { return { id: crypto.randomUUID(), number, title, centerText, note, playSuit, playColor, art: '' }; }

function App() {
  const [cards, setCards] = useState(() => load('cards', pokerCards(false)));
  const [activeId, setActiveId] = useState(cards[0]?.id);
  const [deckName, setDeckName] = useState(() => localStorage.getItem('deckName') || 'Scout Playing Cards');
  const [copyright, setCopyright] = useState(() => localStorage.getItem('copyright') || 'COPY RIGHT Scout System');
  const [template, setTemplate] = useState(() => localStorage.getItem('template') || 'poker52');
  const [customCount, setCustomCount] = useState(() => Number(localStorage.getItem('customCount')) || 12);
  const [printSize, setPrintSize] = useState(() => localStorage.getItem('printSize') || 'r3');
  const [a4PerSheet, setA4PerSheet] = useState(() => Number(localStorage.getItem('a4PerSheet')) || 9);
  const [backPattern, setBackPattern] = useState(() => localStorage.getItem('backPattern') || 'scout');
  const [frontPattern, setFrontPattern] = useState(() => localStorage.getItem('frontPattern') || 'classic');
  const [backColor, setBackColor] = useState(() => localStorage.getItem('backColor') || '#0f766e');
  const [frontColor, setFrontColor] = useState(() => localStorage.getItem('frontColor') || '#1e3a8a');
  const [printSide, setPrintSide] = useState(() => localStorage.getItem('printSide') || 'front');
  const [backUpload, setBackUpload] = useState(() => localStorage.getItem('backUpload') || '');
  const [frontUpload, setFrontUpload] = useState(() => localStorage.getItem('frontUpload') || '');
  const [imageSlot, setImageSlot] = useState(() => localStorage.getItem('imageSlot') || 'iconCenter');
  const [imageStep, setImageStep] = useState(() => Number(localStorage.getItem('imageStep')) || 0);
  const [textLayout, setTextLayout] = useState(() => localStorage.getItem('textLayout') || 'standard');
  const [textStep, setTextStep] = useState(() => Number(localStorage.getItem('textStep')) || 0);

  const activeCard = cards.find(c => c.id === activeId) || cards[0];
  const output = printSizes[printSize];
  const a4 = makeA4Layout(a4PerSheet);
  const a4Card = calcA4CardSize(a4);
  const settings = { deckName, copyright, output, backPattern, frontPattern, backColor, frontColor, backUpload, frontUpload, imageSlot, imageStep, textLayout, textStep };

  useEffect(() => {
    Object.entries({ deckName, copyright, template, customCount, printSize, a4PerSheet, backPattern, frontPattern, backColor, frontColor, printSide, backUpload, frontUpload, imageSlot, imageStep, textLayout, textStep }).forEach(([k, v]) => localStorage.setItem(k, String(v)));
    localStorage.setItem('cards', JSON.stringify(cards));
  }, [cards, deckName, copyright, template, customCount, printSize, a4PerSheet, backPattern, frontPattern, backColor, frontColor, printSide, backUpload, frontUpload, imageSlot, imageStep, textLayout, textStep]);

  const applyTemplate = (nextTemplate) => {
    setTemplate(nextTemplate);
    const build = () => nextTemplate === 'poker52' ? pokerCards(false) : nextTemplate === 'poker54' ? pokerCards(true) : nextTemplate === 'uno108' ? unoCards() : customCards(customCount);
    if (window.confirm(`套用「${templates[nextTemplate].label}」會重新建立卡牌。是否繼續？`)) { const next = build(); setCards(next); setActiveId(next[0].id); }
  };
  const rebuildCustom = () => { const count = Math.max(1, Math.min(160, Number(customCount) || 1)); if (window.confirm(`重新建立 ${count} 張自訂卡？`)) { const next = customCards(count); setCards(next); setActiveId(next[0].id); setTemplate('custom'); } };
  const updateCard = (patch) => setCards(list => list.map(card => card.id === activeCard.id ? { ...card, ...patch } : card));
  const addCard = () => { const card = makeCard(String(cards.length + 1).padStart(2, '0'), `卡牌 ${cards.length + 1}`, '自訂加牌'); setCards([...cards, card]); setActiveId(card.id); };
  const removeCard = () => { if (cards.length <= 1) return; const next = cards.filter(card => card.id !== activeCard.id); setCards(next); setActiveId(next[0].id); };
  const uploadImage = (event, target) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (target === 'card') updateCard({ art: reader.result }); if (target === 'back') { setBackUpload(reader.result); setBackPattern('custom'); } if (target === 'front') { setFrontUpload(reader.result); setFrontPattern('custom'); } };
    reader.readAsDataURL(file);
  };
  const exportJson = () => {
    const data = { deckName, copyright, template, customCount, printSize, a4PerSheet, backPattern, frontPattern, backColor, frontColor, printSide, backUpload, frontUpload, imageSlot, imageStep, textLayout, textStep, cards };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${deckName}-card-design.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importJson = (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const data = JSON.parse(reader.result); setDeckName(data.deckName || deckName); setCopyright(data.copyright || copyright); setTemplate(data.template || 'poker52'); setCustomCount(data.customCount || 12); setPrintSize(data.printSize || 'r3'); setA4PerSheet(Number(data.a4PerSheet || data.a4Count || 9)); setBackPattern(data.backPattern || 'scout'); setFrontPattern(data.frontPattern || 'classic'); setBackColor(data.backColor || '#0f766e'); setFrontColor(data.frontColor || '#1e3a8a'); setPrintSide(data.printSide || 'front'); setBackUpload(data.backUpload || ''); setFrontUpload(data.frontUpload || ''); setImageSlot(data.imageSlot || 'iconCenter'); setImageStep(data.imageStep || 0); setTextLayout(data.textLayout || 'standard'); setTextStep(data.textStep || 0); const imported = (data.cards || []).map(card => ({ ...makeCard('01', '卡牌', '自訂'), ...card, id: card.id || crypto.randomUUID() })); if (imported.length) { setCards(imported); setActiveId(imported[0].id); } } catch { alert('匯入失敗：請選擇正確 JSON 檔。'); } };
    reader.readAsText(file);
  };
  const resetDesign = () => { setBackPattern('scout'); setFrontPattern('classic'); setBackColor('#0f766e'); setFrontColor('#1e3a8a'); setImageSlot('iconCenter'); setImageStep(0); setTextLayout('standard'); setTextStep(0); setBackUpload(''); setFrontUpload(''); };
  const pageStyle = useMemo(() => {
    const page = printSize === 'a4' ? a4.page : output.page;
    const margin = printSize === 'a4' ? '8mm' : '0';
    const pageW = printSize === 'a4' ? (a4.page.includes('landscape') ? 281 : 194) : output.w;
    const pageH = printSize === 'a4' ? (a4.page.includes('landscape') ? 194 : 281) : output.h;
    return `@page{size:${page};margin:${margin};} @media print{.print-sheet{--page-w:${pageW}mm;--page-h:${pageH}mm;--a4-cols:${a4.cols};--a4-gap:${a4.gap}mm;--a4-card-w:${a4Card.w}mm;--a4-card-h:${a4Card.h}mm;}}`;
  }, [output, printSize, a4, a4Card]);

  return <>
    <style>{pageStyle}</style>
    <header className="hero">
      <nav><div className="brand"><img src="/icon.svg" alt="icon"/> Scout Card Studio</div><div className="nav-actions"><button onClick={exportJson}><Download size={16}/>儲存設計</button><label className="button ghost"><Upload size={16}/>載入設計<input hidden type="file" accept="application/json" onChange={importJson}/></label><button className="primary" onClick={() => window.print()}><FileDown size={16}/>列印 / 存成 PDF</button></div></nav>
      <section className="hero-copy compact-title"><p className="eyebrow">COPY RIGHT Scout System</p><h1>啤牌 Canvas</h1><p>選牌組 → 選花色 → 加圖文 → 輸出 PDF</p></section>
    </header>

    <main className="workspace">
      <section className="panel flow rail">
        <div className="rail-brand"><Layers size={18}/><span>流程</span></div>
        <button className="rail-step active">① 牌組</button>
        <button className="rail-step">② 花色</button>
        <button className="rail-step">③ 圖文</button>
        <button className="rail-step">④ PDF</button>
        <details className="tutorial"><summary>教學</summary><ol><li><strong>固定卡尺寸</strong><span>{CARD_SIZE.label}，適合 3R / 4R 相片紙。</span></li><li><strong>選卡牌數量</strong><span>52、54、UNO 或自訂張數。</span></li><li><strong>選牌底 / 牌面花色</strong><span>可用預設，亦可上傳圖案。</span></li><li><strong>選圖案位置</strong><span>例如左上 LOGO、中間圖案、中間大圖，系統自動縮放。</span></li><li><strong>需要才按 + / -</strong><span>只做輕微放大縮小，不需要手動對位。</span></li></ol></details>
        <div className="mini-copy">{copyright}</div>
      </section>

      <section className="panel controls"><div className="panel-title"><Paintbrush size={18}/>設定</div><div className="form-grid two">
        <label>卡組名稱<input value={deckName} onChange={e => setDeckName(e.target.value)} /></label>
        <label>版權字句<input value={copyright} onChange={e => setCopyright(e.target.value)} /></label>
        <label>牌組<select value={template} onChange={e => applyTemplate(e.target.value)}>{Object.entries(templates).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select><span className="field-pill">{cards.length} 張</span></label>
        <label>自訂張數<input type="number" min="1" max="160" value={customCount} onChange={e => setCustomCount(e.target.value)} onBlur={rebuildCustom}/></label>
        <label>輸出<select value={printSize} onChange={e => setPrintSize(e.target.value)}>{Object.entries(printSizes).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
        {printSize === 'a4' && <label>A4 每張紙幾隻<input list="a4-counts" type="number" min="1" max="80" value={a4PerSheet} onChange={e => setA4PerSheet(Number(e.target.value))} onBlur={() => setA4PerSheet(Math.max(1, Math.min(80, Number(a4PerSheet) || 1)))}/><datalist id="a4-counts">{a4Choices.map(n => <option key={n} value={n}>{n} 隻</option>)}</datalist><span className="field-pill">{a4.page.includes('landscape') ? '橫向' : '直向'}｜{a4.cols}×{a4.rows}｜約 {a4Card.w}×{a4Card.h}mm｜剪裁虛線</span></label>}
        <label>列印哪一面<select value={printSide} onChange={e => setPrintSide(e.target.value)}><option value="front">牌面</option><option value="back">牌底</option><option value="both">牌面 + 牌底</option></select></label>
        <label>牌底花色<select value={backPattern} onChange={e => setBackPattern(e.target.value)}>{backPatterns.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label>牌底主色<input type="color" value={backColor} onChange={e => setBackColor(e.target.value)} /></label>
        <label>上傳牌底圖案<input type="file" accept="image/*" onChange={e => uploadImage(e, 'back')} /></label>
        <label>牌面花色<select value={frontPattern} onChange={e => setFrontPattern(e.target.value)}>{frontPatterns.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label>牌面主色<input type="color" value={frontColor} onChange={e => setFrontColor(e.target.value)} /></label>
        <label>上傳牌面花色圖案<input type="file" accept="image/*" onChange={e => uploadImage(e, 'front')} /></label>
      </div><div className="toolbar"><button onClick={resetDesign}><RotateCcw size={16}/>重設花色</button></div></section>

      <section className="preview-zone"><div className="preview-header"><Sparkles size={18}/>預覽</div><div className="preview-pair"><CardPreview side="back" card={activeCard} settings={settings}/><CardPreview side="front" card={activeCard} settings={settings}/></div><p className="hint compact-hint">位置和大小已自動處理。A4 輸出會加剪裁虛線。</p></section>

      <section className="panel card-content"><div className="panel-title"><ImagePlus size={18}/>內容</div><div className="card-tabs">{cards.slice(0, 80).map(card => <button key={card.id} className={card.id === activeCard.id ? 'active' : ''} onClick={() => setActiveId(card.id)}>{card.number}</button>)}{cards.length > 80 && <span className="more">+{cards.length - 80}</span>}<button onClick={addCard}><Plus size={15}/>加牌</button></div>
        <div className="form-grid two">
          <label>角標 / 卡號<input value={activeCard.number} onChange={e => updateCard({ number: e.target.value })}/></label>
          <label>牌面小標題<input value={activeCard.title} onChange={e => updateCard({ title: e.target.value })}/></label>
          <label className="span-2">中間大文字<input value={activeCard.centerText} onChange={e => updateCard({ centerText: e.target.value })}/></label>
          <label className="span-2">補充文字<textarea value={activeCard.note} onChange={e => updateCard({ note: e.target.value })}/></label>
          <label>圖案位置<select value={imageSlot} onChange={e => setImageSlot(e.target.value)}>{Object.entries(imageSlots).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
          <label>文字排法<select value={textLayout} onChange={e => setTextLayout(e.target.value)}>{Object.entries(textLayouts).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
        </div>
        <div className="simple-adjust"><div><strong>圖案大小</strong><button onClick={() => setImageStep(Math.max(-2, imageStep - 1))}><Minus size={15}/></button><span>{imageStep === 0 ? '標準' : imageStep > 0 ? `+${imageStep}` : imageStep}</span><button onClick={() => setImageStep(Math.min(2, imageStep + 1))}><Plus size={15}/></button></div><div><strong>文字大小</strong><button onClick={() => setTextStep(Math.max(-2, textStep - 1))}><Minus size={15}/></button><span>{textStep === 0 ? '標準' : textStep > 0 ? `+${textStep}` : textStep}</span><button onClick={() => setTextStep(Math.min(2, textStep + 1))}><Plus size={15}/></button></div></div>
        <div className="toolbar"><label className="button"><ImagePlus size={16}/>上傳中間圖案<input hidden type="file" accept="image/*" onChange={e => uploadImage(e, 'card')}/></label><button onClick={() => updateCard({ art: '' })}>移除圖案</button><button className="danger" onClick={removeCard}><Trash2 size={16}/>刪除卡</button></div>
      </section>
    </main>

    <PrintOutput cards={cards} settings={settings} printSize={printSize} printSide={printSide} a4PerSheet={a4PerSheet} a4={a4} />
  </>;
}


function PrintOutput({ cards, settings, printSize, printSide, a4PerSheet, a4 }) {
  const items = [];
  if (printSide === 'front' || printSide === 'both') cards.forEach(card => items.push({ side: 'front', card, key: `f-${card.id}` }));
  if (printSide === 'back' || printSide === 'both') cards.forEach(card => items.push({ side: 'back', card, key: `b-${card.id}` }));
  if (printSize !== 'a4') {
    return <section className={`print-sheet print-${printSize} side-${printSide}`}>{items.map(item => <CardPreview key={item.key} side={item.side} card={item.card} settings={settings}/>)}</section>;
  }
  const pages = chunk(items, a4.count);
  return <section className={`print-sheet print-a4 a4-${a4PerSheet} side-${printSide}`}>{pages.map((page, index) => <div className="print-page" key={index}>{page.map(item => <CardPreview key={item.key} side={item.side} card={item.card} settings={settings}/>)}</div>)}</section>;
}


function makeA4Layout(count) {
  const safeCount = Math.max(1, Math.min(80, Number(count) || 1));
  const gap = safeCount <= 4 ? 8 : safeCount <= 9 ? 4 : safeCount <= 18 ? 3 : safeCount <= 36 ? 2 : 1;
  let best = null;
  for (const page of ['A4 portrait', 'A4 landscape']) {
    const landscape = page.includes('landscape');
    const pageW = landscape ? 281 : 194;
    const pageH = landscape ? 194 : 281;
    for (let cols = 1; cols <= safeCount; cols++) {
      const rows = Math.ceil(safeCount / cols);
      const size = sizeForGrid(pageW, pageH, cols, rows, gap);
      const score = size.w * size.h;
      const waste = cols * rows - safeCount;
      if (!best || score > best.score || (Math.abs(score - best.score) < 0.01 && waste < best.waste)) {
        best = { count: safeCount, cols, rows, page, gap, score, waste };
      }
    }
  }
  return best;
}

function sizeForGrid(pageW, pageH, cols, rows, gap) {
  const usableW = pageW - gap * (cols - 1);
  const usableH = pageH - gap * (rows - 1);
  const byWidth = usableW / cols;
  const byHeight = usableH / rows;
  const aspect = CARD_SIZE.h / CARD_SIZE.w;
  let w = byWidth;
  let h = w * aspect;
  if (h > byHeight) { h = byHeight; w = h / aspect; }
  return { w, h };
}

function calcA4CardSize(layout) {
  const landscape = layout.page.includes('landscape');
  const pageW = landscape ? 281 : 194;
  const pageH = landscape ? 194 : 281;
  const size = sizeForGrid(pageW, pageH, layout.cols, layout.rows, layout.gap);
  return { w: Number(size.w.toFixed(1)), h: Number(size.h.toFixed(1)) };
}

function chunk(list, size) {
  const pages = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages;
}

function CardPreview({ side, card, settings }) {
  const vars = { '--card-w': `${CARD_SIZE.w}mm`, '--card-h': `${CARD_SIZE.h}mm`, '--front-color': settings.frontColor, '--back-color': settings.backColor, '--image-scale': 1 + settings.imageStep * 0.12, '--text-scale': 1 + settings.textStep * 0.08 };
  return <article className={`card ${side} front-${settings.frontPattern} back-${settings.backPattern} image-${settings.imageSlot} text-${settings.textLayout}`} style={vars}>{side === 'back' ? <CardBack settings={settings}/> : <CardFront card={card} settings={settings}/>}</article>;
}

function CardBack({ settings }) { return <><Pattern name={settings.backPattern} side="back" image={settings.backUpload}/><div className="back-emblem">{settings.backUpload && settings.backPattern === 'custom' ? <img src={settings.backUpload} alt=""/> : <img src="/icon.svg" alt=""/>}</div><h3>{settings.deckName}</h3><p>Scout System</p><small>{settings.copyright}</small></>; }

function CardFront({ card, settings }) {
  const red = card.playColor === 'red' || String(card.playColor).startsWith('#');
  return <><Pattern name={settings.frontPattern} side="front" image={settings.frontUpload}/><div className="front-frame simple-frame"><div className={`corner top-left ${red ? 'red' : ''}`}>{card.number}<span>{card.playSuit}</span></div><div className={`corner top-right ${red ? 'red' : ''}`}>{card.playSuit || suitSymbol(settings.frontPattern)}</div><CardImage card={card} settings={settings}/><CardText card={card} settings={settings}/><div className="copyright-line">{settings.copyright}</div></div></>;
}

function CardImage({ card, settings }) { if (settings.imageSlot === 'none') return null; return <div className="auto-image-slot">{card.art ? <img src={card.art} alt="card art"/> : <DefaultMark pattern={settings.frontPattern}/>}</div>; }
function CardText({ card, settings }) { if (settings.textLayout === 'none') return null; return <div className="auto-text-block"><p className="card-title">{card.title}</p><h2>{card.centerText}</h2><p className="card-note">{card.note}</p></div>; }
function Pattern({ name, side, image }) { const style = image && name === 'custom' ? { backgroundImage: `url(${image})` } : undefined; return <div className={`pattern pattern-${name} pattern-${side}`} style={style} aria-hidden="true"/>; }
function DefaultMark({ pattern }) { return <div className={`default-mark mark-${pattern}`}>{suitSymbol(pattern)}</div>; }
function suitSymbol(pattern) { return ({ classic: '♠', clouds: '☁', forest: '▲', stars: '✦', knots: '∞', blank: '•', scout: '✦', cloud: '☁', compass: '◆', chevron: '⌃', plain: '•', custom: '◎' })[pattern] || '✦'; }
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }

createRoot(document.getElementById('root')).render(<App />);
