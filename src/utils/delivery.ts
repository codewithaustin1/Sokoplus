import { counties } from "../data/counties";

export interface DeliveryPrediction {
  tier: string;
  time: string;
  desc: string;
  cutoffHour: number;
  expectedDate: Date;
}

/**
 * Returns the estimated delivery date based on county and city, handled dynamically.
 */
export function calculateDelivery(
  county: string,
  city: string,
  baseDate: Date = new Date()
): DeliveryPrediction {
  const date = new Date(baseDate);
  const dayOfWeek = date.getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
  const currentHour = date.getHours();

  // Default cutoff hours
  let cutoffHour = 12; // 12:00 PM EAT

  // Setup response values
  let tier = "";
  let desc = "";
  let daysToAdd = 1;

  const isNairobi = county === "Nairobi City County";
  const centralSpots = [
    "Nairobi CBD", "Westlands", "Lavington", "Kilimani", "Kileleshwa", 
    "Hurlingham", "Parklands", "Highridge", "Ngara"
  ];
  const metroCounties = ["Kiambu County", "Kajiado County", "Machakos County"];
  const upcountryCities = [
    "Mombasa City (CBD/Island)", "Kisumu City", "Nakuru City", "Eldoret City"
  ];

  if (isNairobi) {
    const isCentral = centralSpots.includes(city);
    cutoffHour = isCentral ? 13 : 11; // 1:00 PM for central Nairobi CBD, 11:00 AM for suburbs

    if (dayOfWeek === 0) {
      // Sunday: No dispatch today, arrives Monday
      tier = isCentral ? "Express Same-Day" : "Standard Nairobi";
      desc = isCentral 
        ? "Direct courier dispatch. Dispatches Monday morning." 
        : "Fast dispatch through our central hub riders. Dispatches Monday.";
      daysToAdd = 1; // Arrives Monday
    } else {
      const isWeekend = dayOfWeek === 6; // Saturday
      if (isWeekend) {
        cutoffHour = 11; // Earlier Saturday cutoff
      }

      if (currentHour < cutoffHour) {
        tier = isCentral ? "Express Same-Day" : "Standard Nairobi";
        desc = isCentral 
          ? "Direct courier dispatch. Order now for same-day delivery!" 
          : "Fast dispatch through our central hub riders.";
        daysToAdd = 0; // Arrives today
      } else {
        tier = isCentral ? "Express Same-Day" : "Standard Nairobi";
        desc = isCentral 
          ? "Next-day dispatch direct to your door." 
          : "Central hub dispatch. Sent next business day.";
        
        // If ordered after cutoff on Saturday (6), next delivery is Monday (dayOfWeek 1)
        daysToAdd = dayOfWeek === 6 ? 2 : 1;
      }
    }
  } else if (metroCounties.includes(county)) {
    tier = "Metro Priority";
    desc = "Regular regional feeder shuttle service.";
    cutoffHour = 14; // 2:00 PM cutoff

    if (dayOfWeek === 0) {
      daysToAdd = 1; // Ordered Sunday -> Arrives Monday
    } else if (dayOfWeek === 6) {
      // Ordered Saturday -> Arrives Monday
      daysToAdd = 2;
    } else {
      if (currentHour < cutoffHour) {
        daysToAdd = 1; // Arrives tomorrow
      } else {
        // After cutoff: Arrives in 2 days (unless ordered Thursday night/Friday, arriving on Mon)
        daysToAdd = dayOfWeek === 5 ? 3 : 2; 
      }
    }
  } else {
    // Upcountry / Remote
    tier = "Upcountry Premium Parcel";
    desc = "Dispatched via secure courier with end-to-end tracking.";
    cutoffHour = 15; // 3:00 PM cutoff

    const isUpcountryCity = upcountryCities.includes(city);
    const standardCourierTime = isUpcountryCity ? 1 : 2; // Major cities 24h, remote 48h

    if (dayOfWeek === 0) {
      daysToAdd = 1 + standardCourierTime; // Arrives Mon/Tue
    } else if (dayOfWeek === 6) {
      daysToAdd = 2 + standardCourierTime; // Arrives Tue/Wed
    } else {
      if (currentHour < cutoffHour) {
        daysToAdd = standardCourierTime;
      } else {
        daysToAdd = standardCourierTime + 1;
      }
      
      // Push weekend deliveries to next week if they land on Sunday
      const arrivalDay = (dayOfWeek + daysToAdd) % 7;
      if (arrivalDay === 0) {
        daysToAdd += 1; // Delay Sunday arrival to Monday
      }
    }
  }

  // Calculate the target expectation date
  const expectedDate = new Date(date);
  expectedDate.setDate(date.getDate() + daysToAdd);

  // Format the readable expected delivery string
  const formattedDay = expectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  let timeString = "";
  if (daysToAdd === 0) {
    timeString = `Today, ${expectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (Before 5:00 PM)`;
  } else if (daysToAdd === 1 && dayOfWeek !== 6) {
    timeString = `Tomorrow (${formattedDay})`;
  } else {
    timeString = formattedDay;
  }

  return {
    tier,
    time: timeString,
    desc,
    cutoffHour,
    expectedDate,
  };
}

/**
 * Calculates the shipping fee based on county, city, and cart subtotal.
 */
export function calculateShippingFee(
  county: string,
  city: string,
  subtotal: number
): number {
  if (subtotal >= 15000) return 0; // Free shipping threshold of KES 15,000 to reward larger orders responsively

  if (county === "Nairobi City County") {
    const centralSpots = [
      "Nairobi CBD", "Westlands", "Lavington", "Kilimani", "Kileleshwa", 
      "Hurlingham", "Parklands", "Highridge", "Ngara"
    ];
    if (centralSpots.includes(city)) {
      return 150; // Local delivery within key central areas
    }
    return 200; // Local deliveries to Nairobi suburbs
  }

  const metroCounties = ["Kiambu County", "Kajiado County", "Machakos County"];
  if (metroCounties.includes(county)) {
    return 250; // Nairobi Metropolitan area suburbs
  }

  const upcountryCities = [
    "Mombasa City (CBD/Island)", "Kisumu City", "Nakuru City", "Eldoret City"
  ];
  if (upcountryCities.includes(city)) {
    return 350; // Major Upcountry City Centres
  }

  return 450; // Remote/upcountry destinations standard rate
}

/**
 * Returns formatted hours, minutes, and seconds remaining until cutoffHour today (or tomorrow).
 */
export function getCutoffCountdown(cutoffHour: number, baseDate: Date = new Date()) {
  const now = new Date(baseDate);
  const target = new Date(now);
  target.setHours(cutoffHour, 0, 0, 0);

  // If we already passed the cutoff hour today, countdown to tomorrow's cutoff
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const diffMs = target.getTime() - now.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    formatted: `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
  };
}
