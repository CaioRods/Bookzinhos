const {registerPublicProfileImages} = require('./public-profile-images');
// Public sharing is a separate, explicit DTO: never serialize account or book rows.
function stringArray(value) {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []; }
  catch { return []; }
}

function bookDTO(book) {
  return {
    id: book.id, title: book.title, author: book.author || '', description: book.description || '',
    genre: book.genre || 'Outros', rating: Number(book.rating) || 0, reviewCount: Number(book.review_count) || 0,
    isPublic: true, coverColor: book.cover_color || 'lavender-mint', coverImagePath: book.cover_image_path || null,
  };
}

function reviewDTO(review, book) {
  return {
    id: Number(review.id), bookId: book.id, username: review.username,
    avatar: review.avatar || null, rating: Number(review.rating) || 0, comment: review.comment || '',
    hasSpoiler: !!review.hasSpoiler, createdAt: Number(review.createdAt) || 0,
    likes: Number(review.likes) || 0, likedByMe: false,
    comments: (Array.isArray(review.comments) ? review.comments : []).map(comment => ({
      id: Number(comment.id), reviewId: Number(review.id), username: comment.username,
      avatar: comment.avatar || null, content: comment.content || '', createdAt: Number(comment.createdAt) || 0,
    })),
    book: {id:book.id,title:book.title,author:book.author,coverImagePath:book.coverImagePath,coverColor:book.coverColor},
  };
}

function registerPublicProfileRoutes({app, db, sql, loadReviews}) {
  registerPublicProfileImages({app,db,sql});
  app.get('/public/profiles/:username', async (req,res) => {
    res.set('Cache-Control','no-store');
    try {
      const [user] = await db.query(sql`SELECT username, display_name, full_name, handle, bio, avatar, favorite_genres, instagram_handle, tiktok_handle, profile_theme_id, shelf, pandinhas FROM users WHERE username = ${req.params.username} COLLATE NOCASE`);
      if (!user) return res.status(404).json({error:'Usuário não encontrado'});
      const username = user.username;
      const [saved, progress, followerCount, followingCount, uploaded, reviews] = await Promise.all([
        db.query(sql`SELECT s.book_id FROM saved_books s JOIN books b ON b.id = s.book_id WHERE s.username = ${username} COLLATE NOCASE AND b.is_public = 1`),
        db.query(sql`SELECT p.book_id, p.status FROM reading_progress p JOIN books b ON b.id = p.book_id WHERE p.username = ${username} COLLATE NOCASE AND b.is_public = 1`),
        db.query(sql`SELECT COUNT(*) AS count FROM follows WHERE following = ${username} COLLATE NOCASE`),
        db.query(sql`SELECT COUNT(*) AS count FROM follows WHERE follower = ${username} COLLATE NOCASE`),
        db.query(sql`SELECT COUNT(*) AS count FROM books WHERE uploaded_by = ${username} COLLATE NOCASE AND is_public = 1`),
        loadReviews ? loadReviews({username,me:null,limit:30}) : Promise.resolve([]),
      ]);
      const candidateIds = [...new Set([
        ...stringArray(user.shelf), ...saved.map(row => row.book_id),
        ...progress.filter(row => row.status === 'finalizado' || row.status === 'lendo').map(row => row.book_id),
        ...reviews.map(review => review.bookId),
      ].filter(id => typeof id === 'string'))];
      // Keep SQLite's parameter bound small even for long legacy shelves.
      const publicBooks = [];
      for (let offset = 0; offset < candidateIds.length; offset += 400) {
        const values = candidateIds.slice(offset, offset + 400);
        publicBooks.push(...await db.query({
          text: `SELECT id, title, author, description, genre, rating, review_count, cover_color, cover_image_path FROM books WHERE is_public = 1 AND id IN (${values.map(() => '?').join(',')})`,
          values,
        }));
      }
      const booksById = new Map(publicBooks.map(book => [book.id,bookDTO(book)]));
      const onlyPublic = ids => [...new Set(ids.filter(id => booksById.has(id)))];
      const shelf = onlyPublic(stringArray(user.shelf));
      const savedIds = onlyPublic(saved.map(row => row.book_id));
      const finishedIds = onlyPublic(progress.filter(row => row.status === 'finalizado').map(row => row.book_id));
      const reading = onlyPublic(progress.filter(row => row.status === 'lendo').map(row => row.book_id));
      const publicReviews = reviews.filter(review => booksById.has(review.bookId)).map(review => reviewDTO(review,booksById.get(review.bookId)));
      const ids = onlyPublic([...shelf,...savedIds,...finishedIds,...reading,...publicReviews.map(review => review.bookId)]);
      res.json({profile:{
        username, displayName:user.display_name || user.full_name || username, handle:user.handle || username.toLowerCase(),
        bio:user.bio || '', avatar:user.avatar || '', favoriteGenres:stringArray(user.favorite_genres),
        instagram:user.instagram_handle || '', tiktok:user.tiktok_handle || '', themeId:user.profile_theme_id || 'none',
        pandinhas:Number(user.pandinhas) || 0, shelf, savedIds, finishedIds, reading,
        followers:Number(followerCount[0]?.count) || 0, following:Number(followingCount[0]?.count) || 0,
        reviews:publicReviews,
        stats:{uploaded:Number(uploaded[0]?.count) || 0, finished:finishedIds.length, reading:reading.length, reviews:publicReviews.length, saved:savedIds.length},
      },books:ids.map(id => booksById.get(id))});
    } catch {
      res.status(500).json({error:'Não foi possível carregar o perfil público.'});
    }
  });
}

module.exports = {registerPublicProfileRoutes};
