function createRecentActivityPrivacy({db,sql}) {
  let pending;
  const ready=()=>pending ||= db.query(`CREATE TABLE IF NOT EXISTS user_activity_preferences (username TEXT PRIMARY KEY COLLATE NOCASE REFERENCES users(username) ON DELETE CASCADE, share_recent_activity INTEGER NOT NULL DEFAULT 0)`);
  const get=async username=>{await ready();const [row]=await db.query(sql`SELECT share_recent_activity FROM user_activity_preferences WHERE username=${username} COLLATE NOCASE`);return {shareRecentActivity:Number(row?.share_recent_activity)===1};};
  const set=async(username,value)=>{await ready();await db.query(sql`INSERT INTO user_activity_preferences(username,share_recent_activity) VALUES(${username},${value?1:0}) ON CONFLICT(username) DO UPDATE SET share_recent_activity=excluded.share_recent_activity`);return {shareRecentActivity:value};};
  const visibleAuthors=async viewer=>{
    await ready();if(!viewer)return [];
    const rows=await db.query(sql`SELECT p.username FROM user_activity_preferences p WHERE p.share_recent_activity=1 AND p.username<>${viewer} COLLATE NOCASE
      AND EXISTS(SELECT 1 FROM follows f WHERE f.follower=${viewer} COLLATE NOCASE AND f.following=p.username COLLATE NOCASE)
      AND EXISTS(SELECT 1 FROM follows f WHERE f.follower=p.username COLLATE NOCASE AND f.following=${viewer} COLLATE NOCASE)`);
    return rows.map(row=>row.username);
  };
  const reading=async(authors,status,limit)=>{
    if(!authors.length)return [];
    return db.query({text:`SELECT p.username,p.book_id,p.progress,p.last_read_at FROM reading_progress p JOIN books b ON b.id=p.book_id WHERE p.status=? AND b.is_public=1 AND p.username COLLATE NOCASE IN (${authors.map(()=>'?').join(',')}) ORDER BY p.last_read_at DESC LIMIT ?`,values:[status,...authors,limit]});
  };
  return {ready,get,set,visibleAuthors,reading};
}
module.exports=function registerRecentActivity({app,db,sql,requireUser,currentUser}) {
  const service=createRecentActivityPrivacy({db,sql});
  app.get('/me/activity-privacy',requireUser,async(req,res)=>{try{res.set('Cache-Control','private, no-store');res.json(await service.get(currentUser(req)));}catch{res.status(500).json({error:'Não foi possível carregar a privacidade da atividade.'});}});
  app.put('/me/activity-privacy',requireUser,async(req,res)=>{try{if(typeof req.body.shareRecentActivity!=='boolean')return res.status(400).json({error:'Informe se deseja compartilhar a atividade.'});res.json(await service.set(currentUser(req),req.body.shareRecentActivity));}catch{res.status(500).json({error:'Não foi possível salvar a privacidade da atividade.'});}});
  return service;
};
module.exports.createRecentActivityPrivacy=createRecentActivityPrivacy;
