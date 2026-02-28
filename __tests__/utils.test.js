import { describe, it, expect } from 'vitest';
import {
  AFFILIATIONS,
  NOTIFICATION_TYPES,
  extractHashtags,
  extractMentions,
} from '../lib/utils.js';

describe('AFFILIATIONS', () => {
  it('contains 7 affiliations', () => {
    expect(AFFILIATIONS).toHaveLength(7);
  });

  it('includes expected affiliations', () => {
    expect(AFFILIATIONS).toContain('Conservative');
    expect(AFFILIATIONS).toContain('Liberal');
    expect(AFFILIATIONS).toContain('Libertarian');
    expect(AFFILIATIONS).toContain('Socialist');
    expect(AFFILIATIONS).toContain('Centrist');
    expect(AFFILIATIONS).toContain('Apolitical');
  });

  it('has no duplicates', () => {
    const unique = new Set(AFFILIATIONS);
    expect(unique.size).toBe(AFFILIATIONS.length);
  });
});

describe('NOTIFICATION_TYPES', () => {
  it('has all expected notification types', () => {
    expect(NOTIFICATION_TYPES.LIKE).toBe('like');
    expect(NOTIFICATION_TYPES.COMMENT).toBe('comment');
    expect(NOTIFICATION_TYPES.FOLLOW).toBe('follow');
    expect(NOTIFICATION_TYPES.MENTION).toBe('mention');
    expect(NOTIFICATION_TYPES.REPOST).toBe('repost');
    expect(NOTIFICATION_TYPES.MESSAGE).toBe('message');
  });

  it('has 6 types', () => {
    expect(Object.keys(NOTIFICATION_TYPES)).toHaveLength(6);
  });
});

describe('extractHashtags', () => {
  it('extracts single hashtag', () => {
    expect(extractHashtags('Hello #world')).toEqual(['world']);
  });

  it('extracts multiple hashtags', () => {
    expect(extractHashtags('#hello #world #test')).toEqual(['hello', 'world', 'test']);
  });

  it('lowercases hashtags', () => {
    expect(extractHashtags('#Hello #WORLD')).toEqual(['hello', 'world']);
  });

  it('returns empty array for no hashtags', () => {
    expect(extractHashtags('no hashtags here')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractHashtags('')).toEqual([]);
  });

  it('handles hashtags with numbers', () => {
    expect(extractHashtags('#test123')).toEqual(['test123']);
  });

  it('handles hashtags with underscores', () => {
    expect(extractHashtags('#hello_world')).toEqual(['hello_world']);
  });

  it('extracts hashtags from mixed content', () => {
    expect(extractHashtags('Check out #coding and @user for #tips')).toEqual(['coding', 'tips']);
  });

  it('ignores # without word after it', () => {
    expect(extractHashtags('just a # sign')).toEqual([]);
  });
});

describe('extractMentions', () => {
  it('extracts single mention', () => {
    expect(extractMentions('Hello @user')).toEqual(['user']);
  });

  it('extracts multiple mentions', () => {
    expect(extractMentions('@alice and @bob')).toEqual(['alice', 'bob']);
  });

  it('preserves case', () => {
    expect(extractMentions('@Alice @BOB')).toEqual(['Alice', 'BOB']);
  });

  it('returns empty array for no mentions', () => {
    expect(extractMentions('no mentions here')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractMentions('')).toEqual([]);
  });

  it('handles mentions with numbers', () => {
    expect(extractMentions('@user123')).toEqual(['user123']);
  });

  it('handles mentions with underscores', () => {
    expect(extractMentions('@hello_world')).toEqual(['hello_world']);
  });

  it('extracts mentions from mixed content', () => {
    expect(extractMentions('Hey @admin check #this')).toEqual(['admin']);
  });

  it('ignores @ without word after it', () => {
    expect(extractMentions('email @ sign')).toEqual([]);
  });
});
