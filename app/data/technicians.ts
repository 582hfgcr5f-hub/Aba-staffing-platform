export type TechnicianClient = {
  name: string;
  city: string;
  schedule: string;
  status: string;
};

export type TechnicianProfile = {
  id: string;
  name: string;
  city: string;
  state: string;
  zip?: string;
  status: string;
  phone: string;
  email: string;
  preferredContactMethod: string;
  employmentType: string;
  experience?: string;
  travelRadius: string;
  travelMinutes?: number;
  desiredPay?: string;
  hours: string;
  preferredStartTime?: string;
  preferredEndTime?: string;
  availableDays?: string[];
  availableStartDate: string;
  centralReachExperience: string;
  rating?: string;
  notes?: string;
  certifications: string[];
  availability: string;
  clients: TechnicianClient[];
  recruiterNotes: string;
  yearsAba?: number;
  yearsRbt?: number;
  inHomeExperience?: boolean;
  clinicExperience?: boolean;
  severeBehaviorsExperience?: boolean;
  preferredAgeGroup?: string;
  skills?: string[];
  certificationOther?: string;
  skillOther?: string;
  profilePhotoPath?: string;
  profilePhotoName?: string;
  backgroundCheckSubmitted?: boolean;
  backgroundCleared?: boolean;
  drugScreen?: boolean;
  cprVerified?: boolean;
  rbtLicenseVerified?: boolean;
  documents: Array<{ name: string; type: string; updated: string; path?: string }>;
  latitude?: number;
  longitude?: number;
};

export const technicianProfiles: TechnicianProfile[] = [
  {
    id: "amanda-espinoza",
    name: "Amanda Espinoza",
    city: "Rio Rancho",
    state: "NM",
    zip: "87124",
    status: "Interview",
    phone: "505-974-9867",
    email: "A_c_espinoza@outlook.com",
    preferredContactMethod: "Email",
    employmentType: "Contract",
    travelRadius: "50 miles",
    hours: "Available immediately",
    preferredStartTime: "",
    preferredEndTime: "",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    availableStartDate: "June 18, 2026",
    centralReachExperience: "2 years",
    travelMinutes: 50,
    desiredPay: "",
    rating: "",
    notes: "",
    certifications: ["RBT", "CPR/AED"],
    availability: "Open for interviews",
    clients: [
      { name: "North Valley School", city: "Albuquerque", schedule: "M/W/F 8:00 AM", status: "Pending" },
      { name: "Cedar Family Center", city: "Rio Rancho", schedule: "T/Th 1:00 PM", status: "Scheduled" },
    ],
    recruiterNotes: "Strong communication and quick turnaround. Prefers school-based placements near Albuquerque and brings a calm, professional presence to client visits.",
    latitude: 35.2334,
    longitude: -106.6634,
    documents: [
      { name: "Resume", type: "PDF", updated: "2 days ago" },
      { name: "CPR", type: "Certificate", updated: "1 week ago" },
      { name: "RBT Certificate", type: "Certificate", updated: "2 weeks ago" },
      { name: "Driver License", type: "ID", updated: "3 weeks ago" },
    ],
  },
  {
    id: "lezlee-yancey",
    name: "Lezlee Yancey",
    city: "Carlsbad",
    state: "NM",
    zip: "88220",
    status: "Active",
    phone: "575-725-8009",
    email: "Yanceyl@hotmail.com",
    preferredContactMethod: "Phone",
    employmentType: "Full-time",
    travelRadius: "75 miles",
    hours: "10:00 AM–8:00 PM",
    preferredStartTime: "10:00 AM",
    preferredEndTime: "8:00 PM",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    availableStartDate: "May 28, 2026",
    centralReachExperience: "5 years",
    travelMinutes: 75,
    desiredPay: "",
    rating: "",
    notes: "",
    certifications: ["RBT", "Behavior Support Specialist"],
    availability: "Available this week",
    clients: [
      { name: "Allison Arenivar", city: "Carlsbad", schedule: "M-F 9:30 AM", status: "Active" },
      { name: "Damian Navarro", city: "Artesia", schedule: "T/Th 3:00 PM", status: "Active" },
      { name: "Akaius Brewer", city: "Roswell", schedule: "W/Sat 11:00 AM", status: "Active" },
    ],
    recruiterNotes: "Reliable with high-volume scheduling and excellent parent communication. Consistently exceeds expectations across multi-client caseloads.",
    latitude: 32.4207,
    longitude: -104.2269,
    documents: [
      { name: "Resume", type: "PDF", updated: "Today" },
      { name: "CPR", type: "Certificate", updated: "2 days ago" },
      { name: "RBT Certificate", type: "Certificate", updated: "1 month ago" },
      { name: "Driver License", type: "ID", updated: "1 month ago" },
    ],
  },
  {
    id: "samantha-cruz",
    name: "Samantha Cruz",
    city: "Albuquerque",
    state: "NM",
    zip: "87102",
    status: "Assigned",
    phone: "831-756-9677",
    email: "Simplyysamm04@gmail.com",
    preferredContactMethod: "Text",
    employmentType: "Part-time",
    travelRadius: "30 miles",
    hours: "Weekdays, flexible",
    preferredStartTime: "Weekdays",
    preferredEndTime: "Flexible",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    availableStartDate: "July 2, 2026",
    centralReachExperience: "3 years",
    travelMinutes: 30,
    desiredPay: "",
    rating: "",
    notes: "",
    certifications: ["RBT", "First Aid"],
    availability: "Booked for 2 days",
    clients: [
      { name: "Ezeriah Vigil", city: "Albuquerque", schedule: "Mon 4:30 PM", status: "Assigned" },
    ],
    recruiterNotes: "Excellent fit for in-home services and flexible scheduling. Known for thoughtful documentation and strong rapport with families.",
    latitude: 35.1107,
    longitude: -106.61,
    documents: [
      { name: "Resume", type: "PDF", updated: "3 days ago" },
      { name: "CPR", type: "Certificate", updated: "1 week ago" },
      { name: "RBT Certificate", type: "Certificate", updated: "2 weeks ago" },
      { name: "Driver License", type: "ID", updated: "1 month ago" },
    ],
  },
  {
    id: "molly-pace",
    name: "Molly Pace",
    city: "Sioux City",
    state: "IA",
    zip: "51101",
    status: "Available",
    phone: "712-301-4878",
    email: "mollypace69@yahoo.com",
    preferredContactMethod: "Email",
    employmentType: "Full-time",
    travelRadius: "40 miles",
    hours: "8:00 AM–4:30 PM",
    preferredStartTime: "8:00 AM",
    preferredEndTime: "4:30 PM",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    availableStartDate: "August 5, 2026",
    centralReachExperience: "4 years",
    travelMinutes: 40,
    desiredPay: "",
    rating: "",
    notes: "",
    certifications: ["RBT", "CPR/AED"],
    availability: "Open for new assignments",
    clients: [
      { name: "Alpha Zaidon", city: "Sioux City", schedule: "Tue/Thu 10:00 AM", status: "Active" },
    ],
    recruiterNotes: "Warm demeanor, strong rapport with clients, and strong attendance record. A dependable option for community-based services.",
    latitude: 42.4999,
    longitude: -96.3959,
    documents: [
      { name: "Resume", type: "PDF", updated: "Today" },
      { name: "CPR", type: "Certificate", updated: "1 week ago" },
      { name: "RBT Certificate", type: "Certificate", updated: "2 weeks ago" },
      { name: "Driver License", type: "ID", updated: "1 month ago" },
    ],
  },
];
