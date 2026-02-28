const AFFILIATIONS = [
  'Conservative',
  'Liberal',
  'Libertarian',
  'Socialist',
  'Anarchist',
  'Centrist',
  'Apolitical',
];

const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  FOLLOW: 'follow',
  MENTION: 'mention',
  REPOST: 'repost',
  MESSAGE: 'message',
};

function extractHashtags(text) {
  const regex = /#(\w+)/g;
  const matches = text.match(regex);
  return matches ? matches.map(tag => tag.substring(1).toLowerCase()) : [];
}

function extractMentions(text) {
  const regex = /@(\w+)/g;
  const matches = text.match(regex);
  return matches ? matches.map(mention => mention.substring(1)) : [];
}

module.exports = {
  AFFILIATIONS,
  NOTIFICATION_TYPES,
  extractHashtags,
  extractMentions,
};
