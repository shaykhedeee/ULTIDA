export type ClientBrief = {
  clientName: string;
  projectName: string;
  propertyType: string;
  rooms: string;
  style: string;
  budgetRange: string;
  lifestyle?: string;
  storageNeeds?: string;
  kitchenRequirements?: string;
  materials?: string;
  appliancesServices?: string;
  vastuPreference?: string;
  approvalNotes?: string;
};

export const emptyBrief: ClientBrief = {
  clientName: '', projectName: '', propertyType: '', rooms: '', style: '', budgetRange: '', lifestyle: '', storageNeeds: '',
  kitchenRequirements: '', materials: '', appliancesServices: '', vastuPreference: '', approvalNotes: '',
};
