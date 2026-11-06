import type { Item } from '../types'

type SeedItem = Omit<Item, 'id' | 'active' | 'sort' | 'track_stock' | 'in_store' | 'low_threshold' | 'unit_tracking'> & {
  count?: number
  low?: number
  units?: boolean
}

// Starter catalogue built from the 2025 "Inventory" tab, with names cleaned up.
// Counts are last year's figures where the sheet had one — recount before the event.
// Items with no count are logged only (no stock tracking) until someone counts them.
const STARTER: SeedItem[] = [
  { category: 'Hi-Vis', name: 'Yellow', returnable: true, count: 99, low: 10 },
  { category: 'Hi-Vis', name: 'Green', returnable: true, count: 16, low: 3 },
  { category: 'Hi-Vis', name: 'Blue', returnable: true, count: 10, low: 3 },
  { category: 'Hi-Vis', name: 'Orange', returnable: true, count: 10, low: 3 },
  { category: 'Hi-Vis', name: 'Brown', returnable: true, count: 4, low: 1 },

  { category: 'Walkies', name: 'Walkie talkie', returnable: true, units: true },

  { category: 'Lanyards', name: 'Orange', returnable: true, count: 37 },
  { category: 'Lanyards', name: 'Yellow', returnable: true, count: 9 },
  { category: 'Lanyards', name: 'Blue', returnable: true, count: 51 },
  { category: 'Lanyards', name: 'Blue volunteer', returnable: true, count: 148 },
  { category: 'Lanyards', name: 'Red', returnable: true, count: 122 },
  { category: 'Lanyards', name: 'Grey', returnable: true, count: 4 },
  { category: 'Lanyards', name: 'Purple', returnable: true, count: 3 },
  { category: 'Lanyards', name: 'Mixed / random', returnable: true, count: 23 },

  { category: 'Equipment', name: 'Counter / clicker', returnable: true, count: 13, low: 2 },
  { category: 'Equipment', name: 'Megaphone', returnable: true, count: 1 },
  { category: 'Equipment', name: 'Metal detector', returnable: true, count: 2 },
  { category: 'Equipment', name: 'Light stick', returnable: true, count: 3 },
  { category: 'Equipment', name: 'Litter picker (chopsticks)', returnable: true, count: 3 },
  { category: 'Equipment', name: 'First aid box', returnable: true },

  { category: 'Tools', name: 'Drill', returnable: true },
  { category: 'Tools', name: 'Hammer', returnable: true },
  { category: 'Tools', name: 'Scissors', returnable: true },
  { category: 'Tools', name: 'Screwdriver', returnable: true },
  { category: 'Tools', name: 'Glue gun', returnable: true },

  { category: 'Consumables', name: 'Clear pouch', returnable: false, count: 40 },
  { category: 'Consumables', name: 'Tape', returnable: false },
  { category: 'Consumables', name: 'White tape', returnable: false },
  { category: 'Consumables', name: 'Masking tape', returnable: false },
  { category: 'Consumables', name: 'Cable ties', returnable: false },
  { category: 'Consumables', name: 'Screws', returnable: false },
  { category: 'Consumables', name: 'Black bags', returnable: false },
  { category: 'Consumables', name: 'Gloves', returnable: false },
  { category: 'Consumables', name: 'Cleaning materials', returnable: false },
  { category: 'Consumables', name: 'Stationery', returnable: false },
  { category: 'Consumables', name: 'Sandpaper', returnable: false },
  { category: 'Consumables', name: 'First aid materials', returnable: false },
  { category: 'Consumables', name: 'Batteries (AA/AAA)', returnable: false },
  { category: 'Consumables', name: 'Walkie batteries', returnable: false },
  { category: 'Consumables', name: 'Wristband (purple)', returnable: false },
  { category: 'Consumables', name: 'Wristband (blue)', returnable: false },
  { category: 'Consumables', name: 'Wristband (volunteer)', returnable: false },
]

export function starterCatalogue(): Omit<Item, 'id'>[] {
  return STARTER.map((s, i) => ({
    category: s.category,
    name: s.name,
    returnable: s.returnable,
    track_stock: s.count !== undefined,
    in_store: s.count ?? 0,
    low_threshold: s.low ?? 0,
    unit_tracking: !!s.units,
    active: true,
    sort: (i + 1) * 10,
  }))
}

export const CATEGORY_ORDER = ['Hi-Vis', 'Walkies', 'Lanyards', 'Equipment', 'Tools', 'Consumables']

// Fictional people for demo mode only — real data comes from the mastersheet import.
export const DEMO_PEOPLE: [string, string, string, string, string][] = [
  ['Vish Patel', '90001', 'Sanyukta Purush', 'Security', '07700 900101'],
  ['Chiragbhai Shah', '90002', 'Sanyukta Purush', 'Zone-lead', '07700 900102'],
  ['Meera Desai', '90003', 'Yuvati', 'Shoe Racks', '07700 900103'],
  ['Arjun Mistry', '90004', 'Yuvak', 'Car Park/Security', '07700 900104'],
  ['Priya Amin', '90005', 'Sanyukta Mahila', 'Kitchen - Catering', '07700 900105'],
  ['Kiran Joshi', '90006', 'Kishore', 'Shoe Racks', '07700 900106'],
  ['Nisha Bhatt', '90007', 'Kishori', 'Counting', '07700 900107'],
  ['Rohan Parekh', '90008', 'Yuvak', 'AV', '07700 900108'],
  ['Hetal Thakkar', '90009', 'Sanyukta Mahila', 'Haveli Exhibition', '07700 900109'],
  ['Dev Raval', '90010', 'Yuvak', 'Car Park/Security', '07700 900110'],
  ['Anjali Soni', '90011', 'Yuvati', 'First Aid', '07700 900111'],
  ['Sanjay Modi', '90012', 'Sanyukta Purush', 'Maintenance', '07700 900112'],
  ['Jaya Vyas', '90013', 'Sanyukta Mahila', 'Sabha Vyvastha', '07700 900113'],
  ['Tushar Kapadia', '90014', 'Yuvak', 'Production', '07700 900114'],
  ['Rina Gandhi', '90015', 'Sanyukta Mahila', 'Donation Desk', '07700 900115'],
  ['Hari Pandya', '90016', 'Sanyukta Purush', 'Car Park/Security', '07700 900116'],
  ['Kavya Trivedi', '90017', 'Kishori', 'Bookstall', '07700 900117'],
  ['Neel Chauhan', '90018', 'Kishore', 'Shoe Racks', '07700 900118'],
  ['Pooja Rana', '90019', 'Yuvati', 'Kitchen - Food Stall Serving', '07700 900119'],
  ['Mahesh Solanki', '90020', 'Sanyukta Purush', 'Shuttle Service', '07700 900120'],
  ['Vishal Patel', '90021', 'Sanyukta Purush', 'Security', '07700 900121'],
  ['Vishnu Patel', '90022', 'Yuvak', 'Windup Seva', '07700 900122'],
  ['Rakesh Thakkar', '90023', 'Sanyukta Purush', 'Zone-lead', '07700 900201'],
  ['Bhavesh Mehta', '90024', 'Sanyukta Purush', 'Zone-lead', '07700 900202'],
]
