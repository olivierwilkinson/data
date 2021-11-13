import { factory, manyOf, oneOf, primaryKey } from '@mswjs/data'
import { omit } from 'lodash'
import { ENTITY_TYPE, PRIMARY_KEY } from '../../lib/glossary'

test('supports creating a bi-directional one-to-one relationship', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      partner: oneOf('user'),
    },
  })

  // create bi-directional relationship between partners
  const starsky = db.user.create({
    id: 'starsky',
  })
  const hutch = db.user.create({
    id: 'hutch',
    partner: starsky,
  })
  const nextStarsky = db.user.update({
    where: { id: { equals: starsky.id } },
    data: { partner: hutch },
    strict: true,
  })!

  expect(hutch.partner).toBe(nextStarsky)
  expect(nextStarsky.partner).toBe(hutch)
})

test('supports creating a bi-directional one-to-many relationship', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      posts: manyOf('post'),
    },
    post: {
      id: primaryKey(String),
      title: String,
      author: oneOf('user'),
    },
  })

  // create bi-directional relationship between author and posts
  const author = db.user.create({ id: 'user-1' })
  const posts = [
    db.post.create({
      id: 'post-1',
      title: 'First post',
      author,
    }),
    db.post.create({
      id: 'post-2',
      title: 'Second post',
      author,
    }),
  ]
  const nextAuthor = db.user.update({
    where: { id: { equals: author.id } },
    data: { posts },
    strict: true,
  })!

  posts.forEach((post) => {
    expect(post.author).toBe(nextAuthor)
    expect(nextAuthor.posts.includes(post)).toBe(true)
  })
})

test('supports creating a bi-directional many-to-many relationship', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      posts: manyOf('post'),
    },
    post: {
      id: primaryKey(String),
      title: String,
      authors: manyOf('user'),
    },
  })

  // create bi-directional relationship between authors and posts
  const authors = [
    db.user.create({ id: 'user-1' }),
    db.user.create({ id: 'user-2' }),
  ]
  const posts = [
    db.post.create({
      id: 'post-1',
      title: 'First post',
      authors,
    }),
    db.post.create({
      id: 'post-2',
      title: 'Second post',
      authors,
    }),
  ]
  const nextAuthors = db.user.updateMany({
    where: { id: { in: authors.map(({ id }) => id) } },
    data: { posts },
    strict: true,
  })!

  expect(nextAuthors).toHaveLength(2)
  posts.forEach((post) => {
    nextAuthors.forEach((author) => {
      expect(post.authors.includes(author)).toBe(true)
      expect(author.posts.includes(post)).toBe(true)
    })
  })
})

test('supports querying by a bi-directional one-to-one relationship', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      partner: oneOf('user'),
    },
  })

  // create bi-directional relationship between partners
  const starsky = db.user.create({
    id: 'starsky',
  })
  const hutch = db.user.create({
    id: 'hutch',
    partner: starsky,
  })
  db.user.update({
    where: { id: { equals: starsky.id } },
    data: { partner: hutch },
    strict: true,
  })!

  // create unrelated user to ensure they are not found
  db.user.create({ id: 'user-unrelated' })

  // can find models using bi-directional relationship
  const starskysPartner = db.user.findFirst({
    where: { partner: { id: { equals: starsky.id } } },
    strict: true,
  })

  expect(starskysPartner).toBe(hutch)
})

test('supports querying by a bi-directional one-to-many relationship', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      posts: manyOf('post'),
    },
    post: {
      id: primaryKey(String),
      title: String,
      author: oneOf('user'),
    },
  })

  // create bi-directional relationship between author and posts
  const firstAuthor = db.user.create({ id: 'user-1' })
  const secondAuthor = db.user.create({ id: 'user-2' })
  const thirdAuthor = db.user.create({ id: 'user-3' })

  const firstPost = db.post.create({
    id: 'post-1',
    title: 'First post',
    author: firstAuthor,
  })
  const secondPost = db.post.create({
    id: 'post-2',
    title: 'Second post',
    author: firstAuthor,
  })
  const thirdPost = db.post.create({
    id: 'post-3',
    title: 'Third post',
    author: secondAuthor,
  })
  const fourthPost = db.post.create({
    id: 'post-4',
    title: 'Fourth post',
    author: thirdAuthor,
  })
  const nextFirstAuthor = db.user.update({
    where: { id: { equals: firstAuthor.id } },
    data: { posts: [firstPost, secondPost] },
    strict: true,
  })!
  const nextSecondAuthor = db.user.update({
    where: { id: { equals: secondAuthor.id } },
    data: { posts: [thirdPost] },
    strict: true,
  })!
  db.user.update({
    where: { id: { equals: thirdAuthor.id } },
    data: { posts: [fourthPost] },
    strict: true,
  })

  // create unrelated user and post to ensure they are not included
  db.user.create({ id: 'user-unrelated' })
  db.post.create({ id: 'post-unrelated' })

  // find posts in one-to-many direction
  const posts = db.post.findMany({
    where: { author: { id: { in: [firstAuthor.id, secondAuthor.id] } } },
    strict: true,
  })!

  const expectedPosts = [firstPost, secondPost, thirdPost]
  expectedPosts.forEach((expectedPost) => {
    expect(posts.includes(expectedPost)).toBe(true)
  })

  // find authors in many-to-one direction
  const authors = db.user.findMany({
    where: { posts: { id: { in: [secondPost.id, thirdPost.id] } } },
    strict: true,
  })!

  const expectedAuthors = [nextFirstAuthor, nextSecondAuthor]
  expectedAuthors.forEach((expectedAuthor) => {
    expect(authors.includes(expectedAuthor)).toBe(true)
  })
})

test('supports querying by a bi-directional many-to-many relationship', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      posts: manyOf('post'),
    },
    post: {
      id: primaryKey(String),
      title: String,
      authors: manyOf('user'),
    },
  })

  // create bi-directional relationship between authors and posts
  const firstAuthor = db.user.create({ id: 'user-1' })
  const secondAuthor = db.user.create({ id: 'user-2' })
  const thirdAuthor = db.user.create({ id: 'user-3' })

  const firstPost = db.post.create({
    id: 'post-1',
    title: 'First post',
    authors: [firstAuthor],
  })
  const secondPost = db.post.create({
    id: 'post-2',
    title: 'Second post',
    authors: [firstAuthor, secondAuthor],
  })
  const thirdPost = db.post.create({
    id: 'post-3',
    title: 'Third post',
    authors: [secondAuthor, thirdAuthor],
  })
  const fourthPost = db.post.create({
    id: 'post-4',
    title: 'Fourth post',
    authors: [thirdAuthor],
  })
  db.user.update({
    where: { id: { equals: firstAuthor.id } },
    data: { posts: [firstPost, secondPost] },
    strict: true,
  })
  db.user.update({
    where: { id: { equals: secondAuthor.id } },
    data: { posts: [thirdPost] },
    strict: true,
  })
  db.user.update({
    where: { id: { equals: thirdAuthor.id } },
    data: { posts: [fourthPost] },
    strict: true,
  })

  // find posts through many-to-many relationship
  const posts = db.post.findMany({
    where: { authors: { id: { in: [firstAuthor.id, secondAuthor.id] } } },
    strict: true,
  })

  const expectedPosts = [firstPost, secondPost, thirdPost]
  expectedPosts.forEach((expectedPost) => {
    expect(posts.includes(expectedPost)).toBe(true)
  })
})

test('supports updating using an entity with a bi-directional one-to-one relation', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      partner: oneOf('user'),
    },
  })

  // create bi-directional relationship between partners
  const hutch = db.user.create({
    id: 'hutch',
    partner: db.user.create({
      id: 'starsky',
    }),
  })
  const starsky = db.user.update({
    where: { id: { equals: 'starsky' } },
    data: { partner: hutch },
    strict: true,
  })!

  // create a user that is not related to starsky or hutch.
  db.user.create({ id: 'user' })

  // update using user with bi-directional relationship
  const updatedUser = db.user.update({
    where: { id: { equals: 'user' } },
    data: { partner: starsky },
    strict: true,
  })

  expect(omit(updatedUser, 'partner.partner')).toEqual({
    [ENTITY_TYPE]: 'user',
    [PRIMARY_KEY]: 'id',
    id: 'user',
    partner: omit(starsky, 'partner'),
  })
})

test('supports updating using an entity with a bi-directional one-to-many relationship', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      posts: manyOf('post'),
    },
    post: {
      id: primaryKey(String),
      title: String,
      author: oneOf('user'),
    },
  })

  // create bi-directional relationship between author and posts
  const author = db.user.create({
    id: 'user-1',
  })
  const posts = [
    db.post.create({
      id: 'post-1',
      title: 'First post',
      author,
    }),
    db.post.create({
      id: 'post-2',
      title: 'Second post',
      author,
    }),
  ]
  const nextAuthor = db.user.update({
    where: { id: { equals: author.id } },
    data: { posts },
    strict: true,
  })!

  // create a post that is not related to author
  db.post.create({
    id: 'post-3',
    title: 'Third post',
  })

  // update post using author with bi-directional relationship
  const post = db.post.update({
    where: { id: { equals: 'post-3' } },
    data: { author: nextAuthor },
    strict: true,
  })!

  expect(post.author).toBe(nextAuthor)
})

test('supports updating using an entity with a bi-directional many-to-many relation', () => {
  const db = factory({
    user: {
      id: primaryKey(String),
      posts: manyOf('post'),
    },
    post: {
      id: primaryKey(String),
      title: String,
      authors: manyOf('user'),
    },
  })

  // create bi-directional relationship between authors and posts
  const authors = [
    db.user.create({
      id: 'user-1',
    }),
    db.user.create({
      id: 'user-2',
    }),
  ]
  const posts = [
    db.post.create({
      id: 'post-1',
      title: 'First post',
      authors,
    }),
    db.post.create({
      id: 'post-2',
      title: 'Second post',
      authors,
    }),
  ]
  const nextAuthors = db.user.updateMany({
    where: { id: { in: authors.map((author) => author.id) } },
    data: { posts },
    strict: true,
  })!

  // create a post that is not related to author
  db.post.create({
    id: 'post-3',
    title: 'Third post',
  })

  // update post using authors with bi-directional relationships
  const post = db.post.update({
    where: { id: { equals: 'post-3' } },
    data: { authors: nextAuthors },
    strict: true,
  })!

  nextAuthors.forEach((author) => {
    expect(post.authors.includes(author)).toBe(true)
  })
})
