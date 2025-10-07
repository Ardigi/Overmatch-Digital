import ThreadDetail from '@/components/collaboration/ThreadDetail';

export default function ThreadPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-5xl mx-auto">
      <ThreadDetail threadId={params.id} />
    </div>
  );
}
