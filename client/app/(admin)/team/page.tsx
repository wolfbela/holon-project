import { Suspense } from 'react';
import { TeamContent } from './_components/team-content';

export default function TeamPage() {
  return (
    <Suspense>
      <TeamContent />
    </Suspense>
  );
}
