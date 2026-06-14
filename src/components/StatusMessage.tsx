import { useStatus } from '../context/StatusContext';

export default function StatusMessage() {
  const { message, type, visible } = useStatus();

  return (
    <div
      id="statusMessage"
      className={`status-message ${type}${visible ? '' : ' hidden'}`}
    >
      {message}
    </div>
  );
}
