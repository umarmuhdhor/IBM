import { LockCollisionDemo } from '../../src/lock-collision-demo';

export default function DemoTestPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: 'var(--lc-bg)',
      }}
    >
      <LockCollisionDemo />
    </main>
  );
}
