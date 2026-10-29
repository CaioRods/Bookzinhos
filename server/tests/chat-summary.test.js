const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeConversations } = require('../chat-summary');

test('conversation summary keeps newest first and counts unread messages', () => {
  const messages = [
    { sender: 'Jude', receiver: 'Caio', content: 'Primeira', created_at: 10, is_read: 0 },
    { sender: 'Caio', receiver: 'Jude', content: 'Resposta', created_at: 20, is_read: 1 },
    { sender: 'Cardan', receiver: 'Caio', content: 'Mais nova', created_at: 30, is_read: 0 },
    { sender: 'Cardan', receiver: 'Caio', content: 'Outra', created_at: 31, is_read: 0 },
  ];
  const users = [{ username: 'Jude', display_name: 'Jude Duarte' }, { username: 'Cardan', display_name: 'Cardan Greenbriar' }];
  const result = summarizeConversations('Caio', messages, users);
  assert.deepEqual(result.map((item) => [item.username, item.unreadCount, item.lastMessage]), [['Cardan', 2, 'Outra'], ['Jude', 1, 'Resposta']]);
});
