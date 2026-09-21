import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { WorkflowDock } from '../../components/ui/primitives';
import './room-design.css';

type Props = {
  projectId?: string | null;
  spaces: ReactNode;
};
export function RoomDesignStudio({ projectId, spaces }: Props) {
  const navigate = useNavigate();

  return (
    <section className="room-design-studio">
      <header className="room-design-hero">
        <div>
          <small>ROOM DESIGN STUDIO</small>
          <h1>Place and refine furniture in the room.</h1>
          <p>Select a room and a wall, then choose furniture from the catalog beside the measured plan. Your saved placement carries directly into the 3D review and drawings.</p>
        </div>
      </header>
      <div className="room-design-current">
        Changes remain a draft until they are saved. Confirmed geometry, openings, and saved furniture are the source for 3D and production.
      </div>
      <div className="room-design-panel">
        {spaces}
      </div>

      {/* Bottom Stage Progression */}
      <WorkflowDock
        currentStageIndex={2}
        totalStages={5}
        stageTitle="Rooms &amp; Spaces"
        stageSummary="Place and refine furniture against measured walls, then review the saved design in 3D."
        beaconTone="gold"
        prevAction={{
          label: 'Client Brief',
          icon: <ArrowLeft size={14} />,
          onClick: () => {
            if (projectId) navigate(`/projects/${projectId}/brief`);
            else navigate(-1);
          },
        }}
        nextAction={{
          label: 'Proceed to Step 3: 3D Scene',
          icon: <ArrowRight size={14} />,
          onClick: () => {
            if (projectId) navigate(`/projects/${projectId}/3d`);
          },
        }}
      />
    </section>
  );
}
