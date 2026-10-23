export const INCIDENT_STAGES = [
  { id: 'reported', label: 'Reported', color: '#94a3b8' },
  { id: 'open', label: 'Open', color: '#38bdf8' },
  { id: 'assigned', label: 'Crew Assigned', color: '#f59e0b' },
  { id: 'in_progress', label: 'In Progress', color: '#a855f7' },
  { id: 'resolved', label: 'Resolved', color: '#10b981' },
  { id: 'closed', label: 'Closed', color: '#64748b' },
];

export const INCIDENT_TYPES = [
  { value: 'pipe_burst', label: 'Pipe Burst' },
  { value: 'contamination', label: 'Contamination' },
  { value: 'supply_failure', label: 'Supply Failure' },
  { value: 'pressure_drop', label: 'Pressure Drop' },
  { value: 'flooding', label: 'Flooding' },
];
