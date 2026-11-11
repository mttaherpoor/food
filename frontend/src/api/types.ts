export type User = {
  id: number
  username: string
  first_name: string
  last_name: string
  is_active: boolean
  is_superuser: boolean
  must_change_password: boolean
  roles: string[]
}

export type ImageData = {
  url: string
  alt: string
}

export type CatalogSelection = {
  id: number
  quantity: number
}

export type ReservationSideItem = {
  side: number
  side_name: string
  quantity: number
  unit_price: number
  total_price: number
}

export type ReservationDrinkItem = {
  drink: number
  drink_name: string
  quantity: number
  unit_price: number
  total_price: number
}

export type CatalogItem = {
  id: number
  name: string
  price: number
  image: string | null
  image_data: ImageData
}

export type ReservationItem = {
  side_items: ReservationSideItem[]
  drink_items: ReservationDrinkItem[]
  id: number
  building: number | null
  building_number_snapshot: string | null
  side: number | null
  side_name: string | null
  drink: number | null
  drink_name: string | null
  food_price: number
  side_price: number
  drink_price: number
  food_quantity: number
  side_quantity: number
  drink_quantity: number
  is_current: boolean
  is_cancelled: boolean
  total_price: number
  datetime_created: string
  datetime_modified: string
}

export type Reservation = {
  id: number
  menu: number
  menu_date: string
  food_name: string
  status: 'res' | 'can'
  current_item: ReservationItem | null
  history: ReservationItem[]
  total_price: number
}

export type WeeklyMenu = {
  food_image: string | null
  food_image_data: ImageData
  id: number
  date: string
  food_name: string
  food_price: number
  reservation: Reservation | null
  can_reserve: boolean
}

export type DailyReport = {
  date: string
  food: string
  reserved_count: number
  cancelled_count: number
  food_quantity: number
  total_toman: number
}



export type Profile = {
  personnel_number: string
  building: number | null
  building_number: string | null
  department: number | null
  department_number: string | null
}

export type ProfileOption = {
  id: number
  number: string
}

export type ProfileOptions = {
  buildings: ProfileOption[]
  departments: ProfileOption[]
}
