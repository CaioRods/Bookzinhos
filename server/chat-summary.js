function summarizeConversations(me, messages, users) {
  const mine = String(me).toLowerCase();
  const profiles = new Map(users.map((user) => [String(user.username).toLowerCase(), user]));
  const grouped = new Map();
  for (const message of messages) {
    const senderIsMe = String(message.sender).toLowerCase() === mine;
    const other = senderIsMe ? message.receiver : message.sender;
    const key = String(other).toLowerCase();
    const current = grouped.get(key) || { username: other, unreadCount: 0, createdAt: 0, lastMessage: '' };
    if (!senderIsMe && !Number(message.is_read)) current.unreadCount += 1;
    if (Number(message.created_at) >= current.createdAt) {
      current.createdAt = Number(message.created_at);
      current.lastMessage = message.content;
    }
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([key, item]) => {
    const profile = profiles.get(key) || {};
    return { ...item, avatar: profile.avatar || null, displayName: profile.display_name || profile.username || item.username, handle: profile.handle || String(item.username).toLowerCase() };
  }).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = { summarizeConversations };
