import type { ReactNode } from 'react';
import './room-design.css';

type Props = {
  projectId?: string | null;
  spaces: ReactNode;
};

export function RoomDesignStudio({ spaces }: Props) {
  return (
    <section className="room-design-studio">
      <header className="room-design-hero">
        <div>
          <small>ROOM DESIGN STUDIO</small>
          <h1>Place and refine furniture in the room.</h1>
        </div>
        <span className="room-design-current">
          Confirmed geometry, openings, and saved furniture drive 3D review and production cutlists.
        </span>
      </header>
      <div className="room-design-panel">
        {spaces}
      </div>
    </section>
  );
}
