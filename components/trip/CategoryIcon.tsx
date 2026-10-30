import {
  BedDouble,
  Car,
  CableCar,
  Beer,
  Mountain,
  Package,
  ShoppingBasket,
  Snowflake,
  UtensilsCrossed,
  HardHat,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  lodging: BedDouble,
  lift_passes: CableCar,
  rental: Snowflake,
  transport: Car,
  groceries: ShoppingBasket,
  food_drinks: UtensilsCrossed,
  apres_ski: Beer,
  gear: HardHat,
  activities: Mountain,
  other: Package,
};

export function CategoryIcon({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = ICONS[category] ?? Package;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
