// import {Agent} from '@mastra/core/agent'
// import {createStep, createWorkflow} from '@mastra/core/workflows'
// import {z} from 'zod'
// import { model } from '../../../config'
// import { placeTool, hotelTool, flightTool } from '../tools'

// const agent = new Agent({
//     name: 'Travel Agent',
//     model,
//     instructions: `
// # ROLE  
// You are a **top-tier travel assistant** designed to help users plan memorable, personalized trips. You prioritize convenience, cost-efficiency, and local insight.

// # OBJECTIVES  
// Your main goal is to craft customized travel plans based on user input. You provide relevant options for flights, hotels, activities, and logistics.

// # ALWAYS COLLECT  
// Before making suggestions, ensure you gather the following:
// - 📍 Origin and Destination cities or countries  
// - 📅 Travel dates (or date range/flexibility)  
// - 💵 Budget (total or per traveler)  
// - 👥 Number of travelers and any age-related needs (e.g., seniors, kids)  
// - ✨ Travel style (luxury, backpacker, eco, adventure, romantic, etc.)  
// - 🧭 Interests and must-see attractions (e.g., food, nightlife, museums, nature)

// # GUIDELINES  
// 1. **Use Real-Time Tools**  
//    - Always pull current data from flights, hotels, and weather tools.  
//    - Cross-reference popular points of interest using place lookup tools.  
//    - If live data is not available, clearly mention it's an estimate.

// 2. **Format All Results Clearly**  
//    - Present summaries with emojis, tables, or sections for clarity.  
//    - Use concise bullet points and markdown formatting for structure.  

// 3. **TRIP BREAKDOWN STRUCTURE**  
//    📌 **SUMMARY**  
//    \`\`\`
//    | Destination | Duration | Budget  | Travelers |
//    |-------------|----------|---------|-----------|
//    | Paris       | 7 days   | $3000   | 2 adults  |
//    \`\`\`

//    ✈️ **FLIGHT OPTIONS**  
//    - [Airline] - [Price]  
//      [Departure Time] → [Arrival Time]  
//      🔗 [Booking Link or Note]

//    🏨 **HOTELS**  
//    - **[Hotel Name]** (★★★★☆)  
//      📍 [Neighborhood] - 💰 [Nightly Price]  
//      ✅ [Perks like “Free Breakfast”, “City View”, etc.]

//    📅 **DAILY PLAN**  
//    **Day 1: [Theme - e.g., Art & History]**  
//    - 09:00: [Visit Louvre Museum] ([€15], ~2h)  
//    - 12:30: [Lunch at Café de Flore] (French, $$)  
//    - 15:00: [Walk along Seine River]  
//    - 19:00: [Dinner reservation at Le Meurice] (Formal)

//    💡 **TIPS & WARNINGS**  
//    - "Book Eiffel Tower tickets 2 weeks early"  
//    - "Avoid central markets on Sundays – many are closed"  
//    - "Get a Paris Visite Pass for unlimited transport"

// 4. **BE BUDGET-CONSCIOUS**  
//    - Show both ideal and budget options  
//    - If exceeding budget, offer alternative suggestions  
//    - Calculate total estimated cost per person and for the group

// 5. **PRACTICAL SAFETY ADVICE**  
//    - Mention local safety concerns, scams, or no-go areas  
//    - Highlight visa requirements, cultural customs, and tipping norms  
//    - Include public transport details (passes, apps, availability)

// # COMMUNICATION STYLE  
// - Friendly, informative, and confident  
// - Avoid overwhelming users with too many choices  
// - Recommend only well-reviewed options (e.g., 4.0+ rating)

// # EXAMPLE USER QUERY  
// "Plan a 5-day budget-friendly honeymoon to Bali in September. We're into beaches, sunsets, and local culture."

// Your response should begin by confirming trip details and asking follow-up questions if any details are missing.
//   `
// })

// const forecastSchema = z.object({
//   date: z.string(),
//   maxTemp: z.number(),
//   minTemp: z.number(),
//   precipitationChance: z.number(),
//   condition: z.string(),
//   location: z.string(),
// });

// function getWeatherCondition(code: number): string {
//   const conditions: Record<number, string> = {
//     0: "Clear sky",
//     1: "Mainly clear",
//     2: "Partly cloudy",
//     3: "Overcast",
//     45: "Foggy",
//     48: "Depositing rime fog",
//     51: "Light drizzle",
//     53: "Moderate drizzle",
//     55: "Dense drizzle",
//     61: "Slight rain",
//     63: "Moderate rain",
//     65: "Heavy rain",
//     71: "Slight snow fall",
//     73: "Moderate snow fall",
//     75: "Heavy snow fall",
//     95: "Thunderstorm",
//   };
//   return conditions[code] || "Unknown";
// }



// const fetchFlightsStep = createStep({
//     id: "fetch-flights",
//     description: "Find available flights based on user criteria",
//     inputSchema: z.object({
//         from: z.string().describe("IATA code of departure airport (e.g. JFK)"),
//         to: z.string().describe("IATA code of arrival airport (e.g. LOS)"),
//         date: z.string().describe("Departure date in YYYY-MM-DD format"),
//         travelers: z.number().optional().default(1).describe("Number of travelers"),
//         maxStops: z.number().optional().default(2).describe("Maximum number of stops allowed"),
//         budget: z.number().optional().describe("Maximum budget per traveler in USD")
//     }),
//     outputSchema:flightTool.outputSchema,
//     execute: async ({inputData}) => {
//         // Extract input from the params object
//         const input = inputData;
        
//         if (!input) {
//             throw new Error("Input data not found");
//         }

//         const { from, to, date, travelers = 1, maxStops = 2, budget } = input;
        
//         try {
//             const url = `https://booking-com18.p.rapidapi.com/flights/v2/search-oneway?departId=${from}&arrivalId=${to}&departDate=${date}`;
//             const apiKey = process.env.RAPID_API_FLIGHT;
            
//             const response = await fetch(url, {
//                 method: 'GET',
//                 headers: {
//                     'x-rapidapi-key': `${apiKey}`,
//                     'x-rapidapi-host': 'booking-com18.p.rapidapi.com',
//                 },
//             });

//             if (!response.ok) {
//                 throw new Error(`Flight API error: ${response.status} ${response.statusText}`);
//             }

//             const data = await response.json();
//             const offers = data.data.flightOffers || [];

//             // Map and filter flight offers
//             const flights = offers.map((offer: any) => {
//                 const firstSegment = offer.segments[0];
//                 const lastSegment = offer.segments[offer.segments.length - 1];
//                 const airline = firstSegment.legs[0].carriersData[0].name;
                
//                 // Calculate total duration in hours and minutes
//                 const totalSeconds = firstSegment.totalTime;
//                 const hours = Math.floor(totalSeconds / 3600);
//                 const minutes = Math.floor((totalSeconds % 3600) / 60);
//                 const duration = `${hours}h ${minutes}m`;
                
//                 // Calculate stops
//                 const stops = firstSegment.legs.length - 1;
                
//                 // Calculate price per traveler
//                 const priceUnits = offer.priceBreakdown.total.units || 0;
//                 const priceNanos = offer.priceBreakdown.total.nanos || 0;
//                 const price = priceUnits + (priceNanos / 1000000000);
//                 const pricePerTraveler = price / travelers;

//                 return {
//                     airline,
//                     price: pricePerTraveler,
//                     departureTime: firstSegment.departureTime,
//                     arrivalTime: lastSegment.arrivalTime,
//                     duration,
//                     stops,
//                     bookingToken: offer.token
//                 };
//             })
//             .filter((flight: any) => flight.stops <= maxStops)
//             .filter((flight: any) => !budget || flight.price <= budget)
//             .sort((a: any, b: any) => a.price - b.price);

//             if (flights.length === 0) {
//                 throw new Error('No flights found matching your criteria.');
//             }

//             return flights;
//         } catch (error) {
//             console.error('Flight search error:', error);
//             throw new Error(`Failed to fetch flights: ${error instanceof Error ? error.message : String(error)}`);
//         }
//     }
// });

// const hotelStep = createStep({
//   id: 'get-hotel-step',
//   description: 'Fetches a hotel in the specified location within a given date range and optional price filter.',
  
//   inputSchema: z.object({
//     location: z.string().describe('Location of the hotel'),
//     checkInDate: z.string().describe('Check-in date in YYYY-MM-DD format'),
//     checkOutDate: z.string().describe('Check-out date in YYYY-MM-DD format'),
//     maxPrice: z.number().optional().describe('Maximum price per night in USD'),
//   }),

//   outputSchema: hotelTool.outputSchema,

//   execute: async (context) => {
//     const { location, checkInDate, checkOutDate, maxPrice } = context.inputData;

//     const apiKey = process.env.RAPID_API_HOTEL;

//     const headers = {
//       'X-RapidAPI-Key': apiKey!,
//       'X-RapidAPI-Host': 'tripadvisor16.p.rapidapi.com',
//     };

//     try {
//       // Get geoId for location
//       const locationRes = await fetch(
//         `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation?query=${encodeURIComponent(location)}`,
//         { headers }
//       );
//       const locationData = await locationRes.json();
//       const geoId = locationData?.data?.[0]?.geoId;

//       if (!geoId) {
//         throw new Error(`Could not find geoId for "${location}"`);
//       }

//       // Search hotels with geoId and dates
//       const hotelRes = await fetch(
//         `https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels?geoId=${geoId}&checkIn=${checkInDate}&checkOut=${checkOutDate}&pageNumber=1&currencyCode=USD`,
//         { headers }
//       );
//       const hotelData = await hotelRes.json();
//       const hotels = hotelData?.data?.data;

//       if (!hotels?.length) {
//         throw new Error('No hotels found for this location and date range.');
//       }

//       // Find first hotel under maxPrice if specified
//       const selectedHotel = hotels.find((hotel: any) => {
//         const price = parseFloat(hotel.priceForDisplay?.replace(/[^0-9.]/g, '') || '0');
//         return !maxPrice || price <= maxPrice;
//       });

//       if (!selectedHotel) {
//         throw new Error('No hotels found under the specified price limit.');
//       }

//       return {
//         name: selectedHotel.title,
//         price: parseFloat(selectedHotel.priceForDisplay?.replace(/[^0-9.]/g, '') || '0'),
//         address: selectedHotel.secondaryInfo || 'Unknown',
//         rating: selectedHotel.bubbleRating || 4.0,
//         neighborhood: selectedHotel.neighborhoodName || 'Not specified',
//         perks: selectedHotel.tagTexts || [],
//         image: selectedHotel.cardPhotos?.[0]?.sizes?.urlTemplate?.replace('{width}', '500') || null,
//       };
//     } catch (err) {
//       throw new Error(`Hotel step failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
//     }
//   },
// });

//  const placeStep = createStep({
//   id: 'find-place-step',
//   description: 'Step to find a place using the Foursquare API.',
//   inputSchema: z.object({
//     location: z.string().describe('Location to search for places, e.g. "Chicago"'),
//     type: z.string().optional().describe('Type of place, e.g. "coffee", "restaurant", "museum"'),
//   }),
//   outputSchema: placeTool.outputSchema,
//   execute: async ({inputData}) => {
//     const {location, type} = inputData
//     const apiKey = process.env.FOURSQUARE_API_KEY;
//     if (!apiKey) {
//       throw new Error('Missing FOURSQUARE_API_KEY in environment variables');
//     }

//     const queryParams = new URLSearchParams({
//       near: location,
//       query: type || '',
//       limit: '1',
//     });

//     try {
//           const response = await fetch(
//         `https://places-api.foursquare.com/places/search?${queryParams.toString()}`,
//         {
//           method: 'GET',
//           headers: {
//             Accept: 'application/json',
//             Authorization: apiKey,
//             'X-Places-Api-Version': '2025-06-17',
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error(`Foursquare API error: ${response.status} ${response.statusText}`);
//       }

//       const data = await response.json();

//       const firstResult = data.results?.[0];
//       if (!firstResult) {
//         throw new Error('No places found for the specified query.');
//       }

//       const mappedData = {
//         name: firstResult.name,
//         address: firstResult.location?.formatted_address || `${firstResult.location?.address}, ${firstResult.location?.locality}`,
//         email: firstResult.email || undefined,
//         tel: firstResult.tel || undefined,
//       };

//       return placeTool.outputSchema.parse(mappedData)
//     } catch (error) {
//          console.error('Foursquare Place API error:', error);
//       throw new Error(`Failed to fetch place details: ${error instanceof Error ? error.message : String(error)}`);

//     }
//   }
// });

// const fetchWeather = createStep({
//   id: "fetch-weather",
//   description: "Fetches weather forecast for a given city",
//   inputSchema: z.object({
//     city: z.string().describe("The city to get the weather for"),
//   }),
//   outputSchema: forecastSchema,
//   execute: async ({ inputData }) => {
//     if (!inputData) {
//       throw new Error("Input data not found");
//     }

//     const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
//     const geocodingResponse = await fetch(geocodingUrl);
//     const geocodingData = (await geocodingResponse.json()) as {
//       results: { latitude: number; longitude: number; name: string }[];
//     };

//     if (!geocodingData.results?.[0]) {
//       throw new Error(`Location '${inputData.city}' not found`);
//     }

//     const { latitude, longitude, name } = geocodingData.results[0];

//     const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
//     const response = await fetch(weatherUrl);
//     const data = (await response.json()) as {
//       current: {
//         time: string;
//         precipitation: number;
//         weathercode: number;
//       };
//       hourly: {
//         precipitation_probability: number[];
//         temperature_2m: number[];
//       };
//     };

//     const forecast = {
//       date: new Date().toISOString(),
//       maxTemp: Math.max(...data.hourly.temperature_2m),
//       minTemp: Math.min(...data.hourly.temperature_2m),
//       condition: getWeatherCondition(data.current.weathercode),
//       precipitationChance: data.hourly.precipitation_probability.reduce(
//         (acc, curr) => Math.max(acc, curr),
//         0,
//       ),
//       location: name,
//     };

//     return forecast;
//   },
// });

// const planActivities = createStep({
//   id: "plan-activities",
//   description: "Creates personalized daily activity plans based on traveler preferences and weather",
//   inputSchema: z.object({
//     location: z.string().describe("Destination city for activities"),
//     dates: z.array(z.string()).describe("Array of dates in YYYY-MM-DD format"),
//     interests: z.array(z.string()).describe("Traveler interests (e.g., museums, food, nature)"),
//     travelStyle: z.enum(["luxury", "budget", "adventure", "romantic", "family"]).describe("Travel style preference"),
//     weather: forecastSchema.optional().describe("Current weather forecast for the location")
//   }),
//   outputSchema: z.array(
//     z.object({
//       date: z.string(),
//       theme: z.string(),
//       activities: z.array(
//         z.object({
//           time: z.string(),
//           name: z.string(),
//           description: z.string(),
//           duration: z.string(),
//           cost: z.string().optional(),
//           location: z.string().optional(),
//           weatherConsideration: z.string().optional()
//         })
//       )
//     })
//   ),
//   execute: async (params) => {
//     const { location, dates, interests, travelStyle, weather } = params.inputData;
    
//     try {
//       // Get weather if not provided - using direct fetch instead of context.runStep
//       let currentWeather = weather;
//       if (!currentWeather) {
//         const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=weathercode&timezone=auto`;
//         const response = await fetch(weatherUrl);
//         const data = await response.json();
//         currentWeather = {
//           date: new Date().toISOString(),
//           maxTemp: 25, // Default values
//           minTemp: 15,
//           condition: getWeatherCondition(data.current?.weathercode || 0),
//           precipitationChance: 0,
//           location
//         };
//       }

//       // Generate daily plans using the agent
//       const prompt = `
//       Create a detailed daily activity plan for a trip to ${location} with these characteristics:
//       - Travel Style: ${travelStyle}
//       - Interests: ${interests.join(", ")}
//       - Weather: ${currentWeather.condition}, ${currentWeather.minTemp}°C to ${currentWeather.maxTemp}°C
//       - Dates: ${dates.join(", ")}
      
//       Use this exact JSON format for each day (include the opening and closing brackets):
//       [
//         {
//           "date": "YYYY-MM-DD",
//           "theme": "Day theme based on interests",
//           "activities": [
//             {
//               "time": "09:00",
//               "name": "Activity name",
//               "description": "Detailed description",
//               "duration": "2h",
//               "cost": "$-$$$",
//               "location": "Address or area",
//               "weatherConsideration": "How this suits current weather"
//             }
//           ]
//         }
//       ]`;

//       const response = await agent.stream([
//         { role: "user", content: prompt }
//       ]);

//       let activitiesText = "";
//       for await (const chunk of response.textStream) {
//         activitiesText += chunk;
//       }

//       // Parse and validate the response
//       const dailyPlans = JSON.parse(activitiesText.trim());
//       return dailyPlans;
      
//     } catch (error) {
//       console.error('Activity planning error:', error);
//       throw new Error(`Failed to plan activities: ${error instanceof Error ? error.message : String(error)}`);
//     }
//   }
// });


// const travelWorkflow = createWorkflow({
//   id: "travel-workflow",
//   description: "Complete travel planning workflow",
//   inputSchema: z.object({
//     from: z.string().length(3).describe("IATA departure airport code (3 letters)"),
//     to: z.string().min(2).describe("Destination city name"),
//     departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Departure date (YYYY-MM-DD)"),
//     returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Return date (YYYY-MM-DD)"),
//     travelers: z.number().int().positive().default(1),
//     budget: z.number().positive().optional(),
//     interests: z.array(z.string().min(2)).min(1),
//     travelStyle: z.enum(["luxury", "budget", "adventure", "romantic", "family"])
//   }),
//   outputSchema: z.object({
//     summary: z.object({
//       destination: z.string(),
//       duration: z.string(),
//       totalCostEstimate: z.number(),
//       travelers: z.number()
//     }),
//     flights: flightTool.outputSchema,
//     selectedFlight: flightTool.outputSchema.optional(),
//     hotels: z.array(hotelTool.outputSchema),
//     selectedHotel: hotelTool.outputSchema.optional(),
//     placesOfInterest: z.array(placeTool.outputSchema),
//     weatherForecast: z.array(forecastSchema),
//     dailyPlans: planActivities.outputSchema,
//     recommendations: z.array(z.string())
//   }),
// })

// // Commit the workflow
// travelWorkflow.commit();


// export { travelWorkflow };
