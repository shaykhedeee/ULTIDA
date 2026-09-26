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
          <p>
            Select a room and a wall, then choose furniture from the catalog beside the measured plan.
            Your saved placement carries directly into the 3D review and drawings.
          </p>
        </div>
      </header>
      <div className="room-design-current">
        Changes remain a draft until they are saved. Confirmed geometry, openings, and saved furniture are the source for 3D and production.
      </div>
      <div className="room-design-panel">
        {spaces}
      </div>
    </section>
  );
}
