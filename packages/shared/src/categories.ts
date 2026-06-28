/**
 * Business-category taxonomy — the single source of truth for the onboarding
 * category picker AND the URL-analysis auto-detection (so the two never drift).
 *
 * Why labels look the way they do: the category drives competitor ad discovery
 * (Transparency Center autocomplete, which matches advertiser NAMES — see
 * services/ai/src/gaa_ai/scrape/live.py). So labels are clean, human, "searchable"
 * business phrases ("Medical Spa", "HVAC Services"), not slugs or jargon.
 *
 * Niche businesses that fit none of these use the onboarding "Other…" free-text
 * path; `category` on the client stays a plain nullable string, so anything is
 * allowed — this list is curation, not a hard constraint.
 */

export interface CategoryGroup {
  group: string;
  categories: string[];
}

export const BUSINESS_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: "Health & Beauty",
    categories: [
      "Medical Spa",
      "Dermatology Clinic",
      "Plastic Surgery",
      "Cosmetic Injectables (Botox & Fillers)",
      "Dental Practice",
      "Cosmetic Dentistry",
      "Orthodontist",
      "Optometry & Eye Care",
      "Hair Salon",
      "Barbershop",
      "Nail Salon",
      "Day Spa & Massage",
      "Weight Loss Clinic",
      "Laser Hair Removal",
      "Tattoo Studio",
    ],
  },
  {
    group: "Fitness & Wellness",
    categories: [
      "Gym & Fitness Center",
      "Yoga Studio",
      "Pilates Studio",
      "CrossFit Box",
      "Personal Training",
      "Nutritionist & Dietitian",
      "Chiropractor",
      "Physical Therapy",
      "Mental Health & Therapy",
    ],
  },
  {
    group: "Home Services",
    categories: [
      "HVAC Services",
      "Plumbing",
      "Electrician",
      "Roofing",
      "Landscaping & Lawn Care",
      "Pest Control",
      "House Cleaning",
      "Painting Contractor",
      "Garage Door Services",
      "Solar Installation",
      "Window & Door Installation",
      "Flooring",
      "Pool Service",
      "Handyman",
      "Locksmith",
      "Moving & Storage",
    ],
  },
  {
    group: "Real Estate & Construction",
    categories: [
      "Real Estate Agency",
      "Property Management",
      "Home Builder",
      "General Contractor",
      "Interior Design",
      "Architecture Firm",
      "Mortgage Broker",
      "Home Remodeling",
    ],
  },
  {
    group: "Legal",
    categories: [
      "Personal Injury Lawyer",
      "Family Law & Divorce Attorney",
      "Criminal Defense Attorney",
      "Estate Planning Attorney",
      "Immigration Lawyer",
      "Business & Corporate Law",
      "Bankruptcy Attorney",
      "Employment Lawyer",
    ],
  },
  {
    group: "Financial Services",
    categories: [
      "Accounting & CPA",
      "Tax Preparation",
      "Financial Advisor",
      "Insurance Agency",
      "Bookkeeping",
      "Credit Repair",
      "Mortgage Lending",
    ],
  },
  {
    group: "Automotive",
    categories: [
      "Auto Repair",
      "Auto Body Shop",
      "Car Dealership",
      "Tire Shop",
      "Auto Detailing",
      "Window Tinting",
      "Towing Service",
    ],
  },
  {
    group: "Professional Services",
    categories: [
      "Marketing Agency",
      "Web Design Agency",
      "IT Services & Managed IT",
      "Staffing & Recruiting",
      "Management Consulting",
      "Commercial Photography",
      "Printing Services",
      "Translation Services",
    ],
  },
  {
    group: "Food & Beverage",
    categories: [
      "Restaurant",
      "Café & Coffee Shop",
      "Bakery",
      "Bar & Brewery",
      "Catering",
      "Food Truck",
      "Meal Prep & Delivery",
    ],
  },
  {
    group: "Retail & E-commerce",
    categories: [
      "Apparel & Fashion",
      "Jewelry",
      "Furniture & Home Goods",
      "Consumer Electronics",
      "Beauty & Cosmetics Products",
      "Specialty Foods",
      "Pet Supplies",
      "Sporting Goods",
      "Online Store (General E-commerce)",
    ],
  },
  {
    group: "Education & Childcare",
    categories: [
      "Tutoring",
      "Daycare & Preschool",
      "Private School",
      "Test Prep",
      "Online Courses & E-learning",
      "Music Lessons",
      "Driving School",
    ],
  },
  {
    group: "Travel & Hospitality",
    categories: [
      "Hotel & Lodging",
      "Travel Agency",
      "Vacation Rental",
      "Tour Operator",
      "Event Venue",
    ],
  },
  {
    group: "Events & Personal Services",
    categories: [
      "Wedding Planner",
      "Event Planning",
      "DJ & Entertainment",
      "Florist",
      "Event Photography",
      "Catering & Bartending",
    ],
  },
  {
    group: "Pet Services",
    categories: [
      "Veterinary Clinic",
      "Pet Grooming",
      "Dog Training",
      "Pet Boarding & Daycare",
    ],
  },
  {
    group: "B2B & Technology",
    categories: [
      "SaaS & Software",
      "B2B Services",
      "Manufacturing",
      "Logistics & Freight",
      "Commercial Cleaning",
      "Security Services",
      "Wholesale & Distribution",
    ],
  },
  {
    group: "Other",
    categories: [
      "Nonprofit",
      "Religious Organization",
      "Other",
    ],
  },
];

/** Flat list of every category label, in group order. */
export const BUSINESS_CATEGORIES: string[] = BUSINESS_CATEGORY_GROUPS.flatMap(
  (g) => g.categories,
);

const CATEGORY_BY_LOWER = new Map<string, string>(
  BUSINESS_CATEGORIES.map((c) => [c.toLowerCase(), c]),
);

/** Case-insensitive membership check against the curated taxonomy. */
export function isKnownCategory(value: string): boolean {
  return CATEGORY_BY_LOWER.has(value.trim().toLowerCase());
}

/**
 * Resolve a (possibly LLM-produced) value to its canonical taxonomy label.
 * Exact case-insensitive match → canonical label; anything else → null.
 * Use this to gate auto-detected categories before trusting them as "known".
 */
export function matchCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  return CATEGORY_BY_LOWER.get(value.trim().toLowerCase()) ?? null;
}
