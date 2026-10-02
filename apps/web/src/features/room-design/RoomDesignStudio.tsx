import type { ReactNode } from 'react';
import './room-design.css';

type Props = {
  projectId?: string | null;
  spaces: ReactNode;
};

export function RoomDesignStudio({ spaces }: Props) {
  return (
    <section className="room-design-studio">
      <div className="room-design-panel">
        {spaces}
      </div>
    </section>
  );
}
