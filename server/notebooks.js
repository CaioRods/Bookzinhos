const crypto = require('crypto');
const idPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const number = (n, min, max, fallback = min) => Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
const text = (s, max) => String(s || '').slice(0, max);
const color = s => /^#[0-9a-f]{6}$/i.test(s) ? s : '#354d49';
function image(s) {
  if (!s) return '';
  if (typeof s !== 'string' || s.length > 3000000 || !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(s)) throw new Error('Imagem inválida ou muito grande.');
  return s;
}
function normalizePage(input) {
  if(JSON.stringify(input).length>3500000)throw new Error("Divida este conteúdo em mais páginas. A folha atingiu o limite de tamanho.");
  if (!['plain','parchment','ruled'].includes(input.paper)) throw new Error('Tipo de folha inválido.');
  if (!Array.isArray(input.elements) || input.elements.length > 5000) throw new Error('Esta folha atingiu o limite de elementos. Crie outra página.');
  let points = 0;
  const elements = input.elements.map(e => {
    if (!idPattern.test(e.id)) throw new Error('Elemento inválido.');
    const base = { id: e.id, type: e.type };
    if (e.type === 'stroke') {
      if (!Array.isArray(e.points) || !e.points.length || (points += e.points.length) > 100000) throw new Error('Traços demais nesta folha.');
      return { ...base, color: color(e.color), width: number(e.width, .5, 60, 3), opacity: e.opacity === .3 ? .3 : 1, points: e.points.map(p => { if (!Array.isArray(p) || p.length < 2) throw new Error('Traço inválido.'); return [number(p[0],0,800),number(p[1],0,1100)]; }) };
    }
    const box = { x: number(e.x,0,790), y: number(e.y,0,1090), width: number(e.width,30,800,300), height: number(e.height,30,1100,150) };
    if (e.type === 'text') return { ...base, ...box, text: text(e.text,40000), color: color(e.color), size: number(e.size,10,96,22), font: ['serif','sans','mono'].includes(e.font) ? e.font : 'sans', bold: !!e.bold, italic: !!e.italic, underline: !!e.underline, align: ['left','center','right'].includes(e.align) ? e.align : 'left' };
    if (e.type === 'image') {
      const link = e.source && idPattern.test(e.source.bookId) ? { bookId: e.source.bookId, title: text(e.source.title,200), page: Math.floor(number(e.source.page,1,100000,1)), rect: e.source.rect ? { x:number(e.source.rect.x,0,1), y:number(e.source.rect.y,0,1), width:number(e.source.rect.width,.01,1,1), height:number(e.source.rect.height,.01,1,1) } : undefined } : undefined;
      return { ...base, ...box, src: image(e.src), ...(link ? { source: link } : {}) };
    }
    throw new Error('Tipo de elemento inválido.');
  });
  return { title: text(input.title,100).trim() || 'Página sem título', paper: input.paper, elements };
}
const ICON_IDS=new Set(['sparkles','moon','flower','heart','coffee','book','feather','map','leaf','zap']);
const LEGACY_ICONS={'✦':'sparkles','☾':'moon','❀':'flower','♡':'heart','☕':'coffee','📖':'book','🪶':'feather','🗺️':'map','🗺':'map','🌿':'leaf','⚡':'zap'};
const normalizeIcon=value=>ICON_IDS.has(value)?value:Object.prototype.hasOwnProperty.call(LEGACY_ICONS,value)?LEGACY_ICONS[value]:'sparkles';
function normalizeCoverLayout(value,baseColor){
 if(!value||typeof value!=='object')return undefined;
 const channels=[1,3,5].map(start=>parseInt(baseColor.slice(start,start+2),16)),ink=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>160?'#263c35':'#fffaf1';
 const defaults={title:{x:65,y:330,size:36,width:390},description:{x:65,y:495,size:16,width:390},icon:{x:230,y:225,size:60,width:60}},result={};
 for(const key of Object.keys(defaults)){const item=value[key]||{},fallback=defaults[key];result[key]={x:number(item.x,0,500,fallback.x),y:number(item.y,0,700,fallback.y),size:number(item.size,key==='icon'?12:8,key==='icon'?180:100,fallback.size),width:number(item.width,40,520,fallback.width),color:/^#[0-9a-f]{6}$/i.test(item.color)?item.color:ink};}
 return result;
}
function normalizeCover(input) {
  return { name: text(input.name,100).replace(/[\r\n]/g,' ').trim() || 'Meu caderno', color: color(input.color), icon: normalizeIcon(input.icon), image: image(input.image), description: text(input.description,200),coverLayout:normalizeCoverLayout(input.coverLayout,color(input.color)) };
}
module.exports = function registerNotebooks({ app, db, sql, currentUser }) {
  let pending;
  const ready = () => pending ||= (async () => {
    await db.query('CREATE TABLE IF NOT EXISTS notebooks (id TEXT PRIMARY KEY,owner TEXT NOT NULL COLLATE NOCASE,data TEXT NOT NULL,revision TEXT NOT NULL,updated_at INTEGER NOT NULL)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notebooks_owner ON notebooks(owner,updated_at)');
    await db.query('CREATE TABLE IF NOT EXISTS notebook_pages (id TEXT PRIMARY KEY,notebook_id TEXT NOT NULL,data TEXT NOT NULL,revision TEXT NOT NULL,position INTEGER NOT NULL,updated_at INTEGER NOT NULL)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notebook_pages ON notebook_pages(notebook_id,position)');
    await db.query('CREATE TABLE IF NOT EXISTS notebook_deleted (kind TEXT NOT NULL,id TEXT NOT NULL,owner TEXT NOT NULL COLLATE NOCASE,deleted_at INTEGER NOT NULL,PRIMARY KEY(kind,id))');
    await db.query('CREATE TABLE IF NOT EXISTS notebook_imports (owner TEXT PRIMARY KEY COLLATE NOCASE)');
    await db.query('CREATE TABLE IF NOT EXISTS notebook_shares (id TEXT PRIMARY KEY,owner TEXT NOT NULL COLLATE NOCASE,recipient TEXT NOT NULL COLLATE NOCASE,notebook_id TEXT NOT NULL,page_id TEXT,created_at INTEGER NOT NULL)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notebook_shares_recipient ON notebook_shares(recipient,created_at)');
  })();
  const member = async (req,res,next) => {
    try {
      const owner = currentUser(req);
      const [user] = owner ? await db.query(sql`SELECT username FROM users WHERE username=${owner} COLLATE NOCASE`) : [];
      if (!user) return res.status(401).json({ error:'Entre na sua conta para abrir suas anotações.' });
      if (req.get('X-Notebook-Account') && req.get('X-Notebook-Account').toLowerCase() !== user.username.toLowerCase()) return res.status(409).json({error:'A conta mudou. Reabra suas anotações.'});
      req.notebookOwner = user.username; await ready(); next();
    } catch (error) { res.status(500).json({error:error.message}); }
  };
  const owned = async (id,owner) => (await db.query(sql`SELECT * FROM notebooks WHERE id=${id} AND owner=${owner} COLLATE NOCASE`))[0];
  const decode = row => {const data=JSON.parse(row.data);return {...data,...(data.icon!==undefined?{icon:normalizeIcon(data.icon)}:{}),id:row.id,revision:row.revision,updatedAt:Number(row.updated_at),...(row.position==null?{}:{position:Number(row.position)})};};
  const summaries = async (id,pageId = null) => (await db.query(sql`SELECT id,json_extract(data,'$.title') AS title,json_extract(data,'$.paper') AS paper,revision,position,updated_at AS updatedAt FROM notebook_pages WHERE notebook_id=${id} AND (${pageId} IS NULL OR id=${pageId}) ORDER BY position, id`));
  async function importLegacy(owner) {
    const [done] = await db.query(sql`SELECT owner FROM notebook_imports WHERE owner=${owner} COLLATE NOCASE`);
    if (done) return;
    const [count] = await db.query(sql`SELECT COUNT(*) AS n FROM notes WHERE username=${owner} COLLATE NOCASE`);
    if (count.n) {
      const id = `legacy-${crypto.createHash('sha256').update(owner.toLowerCase()).digest('hex').slice(0,24)}`;
      await db.query(sql`INSERT OR IGNORE INTO notebooks(id,owner,data,revision,updated_at) VALUES(${id},${owner},${JSON.stringify(normalizeCover({name:'Anotações anteriores',color:'#657b72',icon:'book'}))},'legacy',${Date.now()})`);
      await db.query(sql`INSERT OR IGNORE INTO notebook_pages(id,notebook_id,data,revision,position,updated_at) SELECT 'legacy-' || n.id,${id},json_object('title',COALESCE(b.title,'Leitura') || ' · ' || n.date_label,'paper','ruled','elements',json_array(json_object('id','legacy-text','type','text','x',65,'y',80,'width',670,'height',900,'text',n.feedback || char(10) || char(10) || 'Avaliação na época: ' || n.rating || '/5','color','#354d49','size',22,'font','sans','bold',0,'italic',0,'underline',0,'align','left'))),'legacy',n.created_at,n.created_at FROM notes n LEFT JOIN books b ON b.id=n.book_id WHERE n.username=${owner} COLLATE NOCASE`);
    }
    await db.query(sql`INSERT OR IGNORE INTO notebook_imports(owner) VALUES(${owner})`);
  }
  app.get('/notebooks',member,async(req,res)=>{try{await importLegacy(req.notebookOwner);const rows=await db.query(sql`SELECT n.*,(SELECT COUNT(*) FROM notebook_pages p WHERE p.notebook_id=n.id) AS page_count FROM notebooks n WHERE n.owner=${req.notebookOwner} COLLATE NOCASE ORDER BY n.updated_at DESC`);res.json(rows.map(row=>({...decode(row),pageCount:Number(row.page_count)})));}catch(e){res.status(500).json({error:e.message});}});
  app.put('/notebooks/:id',member,async(req,res)=>{try{
    const {id}=req.params,owner=req.notebookOwner;
    if(!idPattern.test(id)||!idPattern.test(req.body.revision))throw new Error('Identificador inválido.');
    const [deleted]=await db.query(sql`SELECT id FROM notebook_deleted WHERE kind='notebook' AND id=${id}`);if(deleted)return res.status(410).json({error:'Caderno excluído em outro dispositivo. Sua cópia está guardada neste aparelho.'});
    const previous=await owned(id,owner); const [any]=await db.query(sql`SELECT owner FROM notebooks WHERE id=${id}`);
    if(any&&!previous)return res.status(404).json({error:'Caderno não encontrado.'});
    const data=JSON.stringify(normalizeCover(req.body)); const revision=req.body.revision,base=req.body.baseRevision||'';
    if(previous&&previous.revision===revision)return res.json(decode(previous));
    if(previous&&previous.revision!==base)return res.status(409).json({error:'Este caderno foi alterado em outro dispositivo. Sua versão está guardada neste aparelho.'});
    await db.query(sql`INSERT INTO notebooks(id,owner,data,revision,updated_at) SELECT ${id},${owner},${data},${revision},${Date.now()} WHERE NOT EXISTS(SELECT 1 FROM notebook_deleted WHERE kind='notebook' AND id=${id}) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at WHERE notebooks.owner=${owner} COLLATE NOCASE AND notebooks.revision=${base}`);
    const result=await owned(id,owner);if(result?.revision!==revision)return res.status(409).json({error:'Alteração simultânea. Tente sincronizar novamente.'});res.json(decode(result));
  }catch(e){res.status(400).json({error:e.message});}});
  app.get('/notebooks/:id/pages',member,async(req,res)=>{try{if(!await owned(req.params.id,req.notebookOwner))return res.sendStatus(404);res.json(await summaries(req.params.id));}catch(e){res.status(500).json({error:e.message});}});
  app.get('/notebooks/:id/pages/:page',member,async(req,res)=>{try{if(!await owned(req.params.id,req.notebookOwner))return res.sendStatus(404);const [row]=await db.query(sql`SELECT * FROM notebook_pages WHERE id=${req.params.page} AND notebook_id=${req.params.id}`);if(!row)return res.sendStatus(404);res.json(decode(row));}catch(e){res.status(500).json({error:e.message});}});
  app.put('/notebooks/:id/pages/:page',member,async(req,res)=>{try{
    if(!await owned(req.params.id,req.notebookOwner))return res.sendStatus(404);
    const id=req.params.page,revision=req.body.revision,base=req.body.baseRevision||'';
    if(!idPattern.test(id)||!idPattern.test(revision))throw new Error('Identificador inválido.');
    const [deleted]=await db.query(sql`SELECT id FROM notebook_deleted WHERE kind='page' AND id=${id}`);if(deleted)return res.status(410).json({error:'Página excluída em outro dispositivo. Sua cópia está guardada neste aparelho.'});
    const [previous]=await db.query(sql`SELECT * FROM notebook_pages WHERE id=${id}`);
    if(previous&&previous.notebook_id!==req.params.id)return res.sendStatus(404);
    if(previous?.revision===revision)return res.json(decode(previous));
    if(previous&&previous.revision!==base)return res.status(409).json({error:'Esta página mudou em outro dispositivo. Sua versão está guardada neste aparelho.'});
    const data=JSON.stringify(normalizePage(req.body));
    await db.query(sql`INSERT INTO notebook_pages(id,notebook_id,data,revision,position,updated_at) SELECT ${id},${req.params.id},${data},${revision},${number(req.body.position,0,9999999999999,Date.now())},${Date.now()} WHERE EXISTS(SELECT 1 FROM notebooks WHERE id=${req.params.id} AND owner=${req.notebookOwner} COLLATE NOCASE) AND NOT EXISTS(SELECT 1 FROM notebook_deleted WHERE kind='page' AND id=${id}) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision,position=excluded.position,updated_at=excluded.updated_at WHERE notebook_pages.notebook_id=${req.params.id} AND notebook_pages.revision=${base}`);
    const [row]=await db.query(sql`SELECT * FROM notebook_pages WHERE id=${id}`);if(row?.revision!==revision)return res.status(409).json({error:'Alteração simultânea. Sua cópia local foi preservada.'});
    await db.query(sql`UPDATE notebooks SET updated_at=${Date.now()} WHERE id=${req.params.id}`);res.json(decode(row));
  }catch(e){res.status(400).json({error:e.message});}});
  app.delete('/notebooks/:id/pages/:page',member,async(req,res)=>{try{if(!await owned(req.params.id,req.notebookOwner))return res.sendStatus(404);const [existing]=await db.query(sql`SELECT notebook_id FROM notebook_pages WHERE id=${req.params.page}`);if(existing&&existing.notebook_id!==req.params.id)return res.sendStatus(404);if(!idPattern.test(req.params.page))return res.sendStatus(400);await db.query(sql`INSERT OR IGNORE INTO notebook_deleted(kind,id,owner,deleted_at) VALUES('page',${req.params.page},${req.notebookOwner},${Date.now()})`);await db.query(sql`DELETE FROM notebook_pages WHERE id=${req.params.page} AND notebook_id=${req.params.id}`);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});
  app.delete('/notebooks/:id',member,async(req,res)=>{try{if(!await owned(req.params.id,req.notebookOwner))return res.sendStatus(404);await db.query(sql`INSERT OR IGNORE INTO notebook_deleted(kind,id,owner,deleted_at) VALUES('notebook',${req.params.id},${req.notebookOwner},${Date.now()})`);await db.query(sql`DELETE FROM notebooks WHERE id=${req.params.id} AND owner=${req.notebookOwner} COLLATE NOCASE`);await db.query(sql`DELETE FROM notebook_pages WHERE notebook_id=${req.params.id}`);await db.query(sql`DELETE FROM notebook_shares WHERE notebook_id=${req.params.id}`);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});
  app.get('/notebook-shares',member,async(req,res)=>{try{const rows=await db.query(sql`SELECT s.*,n.data FROM notebook_shares s JOIN notebooks n ON n.id=s.notebook_id WHERE s.recipient=${req.notebookOwner} COLLATE NOCASE ORDER BY s.created_at DESC`);res.json(rows.map(row=>({id:row.id,owner:row.owner,pageId:row.page_id,name:JSON.parse(row.data).name,createdAt:Number(row.created_at)})));}catch(e){res.status(500).json({error:e.message});}});
  app.post('/notebooks/:id/shares',member,async(req,res)=>{try{
    const notebook=await owned(req.params.id,req.notebookOwner);if(!notebook)return res.sendStatus(404);
    const [recipient]=await db.query(sql`SELECT username FROM users WHERE username=${String(req.body.recipient||'')} COLLATE NOCASE`);if(!recipient)return res.status(400).json({error:'Pessoa não encontrada.'});
    const pageId=req.body.pageId||null;
    if(pageId){const [page]=await db.query(sql`SELECT id FROM notebook_pages WHERE id=${pageId} AND notebook_id=${notebook.id}`);if(!page)return res.sendStatus(404);}
    const id=crypto.randomUUID(),title=JSON.parse(notebook.data).name;
    await db.query(sql`INSERT INTO notebook_shares(id,owner,recipient,notebook_id,page_id,created_at) VALUES(${id},${req.notebookOwner},${recipient.username},${notebook.id},${pageId},${Date.now()})`);
    await db.query(sql`INSERT INTO chat_messages(sender,receiver,content,created_at) VALUES(${req.notebookOwner},${recipient.username},${`${pageId?'Página de':'Caderno'}: ${title}\n/notes?share=${id}`},${Date.now()})`);
    res.status(201).json({id});
  }catch(e){res.status(500).json({error:e.message});}});
  async function allowedShare(req){return (await db.query(sql`SELECT * FROM notebook_shares WHERE id=${req.params.share} AND (recipient=${req.notebookOwner} COLLATE NOCASE OR owner=${req.notebookOwner} COLLATE NOCASE)`))[0];}
  app.get('/notebook-shares/:share',member,async(req,res)=>{try{const share=await allowedShare(req);if(!share)return res.sendStatus(404);const [book]=await db.query(sql`SELECT * FROM notebooks WHERE id=${share.notebook_id}`);if(!book)return res.sendStatus(404);res.json({notebook:decode(book),pages:await summaries(book.id,share.page_id),owner:share.owner});}catch(e){res.status(500).json({error:e.message});}});
  app.get('/notebook-shares/:share/pages/:page',member,async(req,res)=>{try{const share=await allowedShare(req);if(!share||(share.page_id&&share.page_id!==req.params.page))return res.sendStatus(404);const [row]=await db.query(sql`SELECT p.* FROM notebook_pages p JOIN notebooks n ON n.id=p.notebook_id WHERE p.id=${req.params.page} AND p.notebook_id=${share.notebook_id}`);if(!row)return res.sendStatus(404);res.json(decode(row));}catch(e){res.status(500).json({error:e.message});}});
  return {ready};
};
module.exports.normalizePage=normalizePage;
