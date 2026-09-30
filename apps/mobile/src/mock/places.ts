import type { Place } from '@/lib/mapbox';

// Sample Lagos places used when no Mapbox token is set.
export const mockPlaces: Place[] = [
  { id: 'mp-unilag', name: 'University of Lagos', address: 'Akoka, Yaba, Lagos', coord: { latitude: 6.5158, longitude: 3.3896 } },
  { id: 'mp-ikeja-mall', name: 'Ikeja City Mall', address: 'Obafemi Awolowo Way, Ikeja, Lagos', coord: { latitude: 6.6143, longitude: 3.3576 } },
  { id: 'mp-yaba-market', name: 'Tejuosho Market', address: 'Yaba, Lagos', coord: { latitude: 6.5076, longitude: 3.3709 } },
  { id: 'mp-surulere', name: 'National Stadium', address: 'Surulere, Lagos', coord: { latitude: 6.4995, longitude: 3.3658 } },
  { id: 'mp-kings-college', name: "King's College", address: 'Catholic Mission St, Lagos Island', coord: { latitude: 6.4526, longitude: 3.3958 } },
  { id: 'mp-lekki-ph1', name: 'Lekki Phase 1 Gate', address: 'Admiralty Way, Lekki, Lagos', coord: { latitude: 6.4474, longitude: 3.4739 } },
  { id: 'mp-vi', name: 'Eko Hotel', address: 'Adetokunbo Ademola St, Victoria Island, Lagos', coord: { latitude: 6.4262, longitude: 3.4304 } },
  { id: 'mp-luth', name: 'Lagos University Teaching Hospital', address: 'Idi-Araba, Surulere, Lagos', coord: { latitude: 6.5177, longitude: 3.3553 } },
  { id: 'mp-ojota', name: 'Ojota Bus Terminal', address: 'Ikorodu Rd, Ojota, Lagos', coord: { latitude: 6.5855, longitude: 3.3796 } },
  { id: 'mp-queens', name: "Queen's College", address: 'Yaba, Lagos', coord: { latitude: 6.5037, longitude: 3.3781 } },
];
