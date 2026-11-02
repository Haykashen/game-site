export function FeedTags({ tags }: { tags: readonly string[] }) {
  return <div className="feed-tags">{tags.map(tag => <span className="feed-tag" key={tag}>{tag}</span>)}</div>;
}
