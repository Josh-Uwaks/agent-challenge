import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { placeTool, hotelTool, flightTool } from '../tools';
import { weatherTool } from '../../weather-agent/weather-tool';

// Updated schemas to match the new hotel tool output
const TravelInformationSchema = z.object({
  destination: z.string(),
  duration: z.string(),
  totalCostEstimate: z.number(),
  travelers: z.number(),
  budgetAllocation: z.object({
    flights: z.number(),
    accommodation: z.number(),
    activities: z.number(),
    miscellaneous: z.number()
  })
});

const ActivityInfoSchema = z.object({
  address: z.string(),
  postcode: z.string(),
  email: z.string().email(),
  tel: z.string(),
  website: z.string().url().optional(),
  distance: z.number()
});

const ActivityPlanSchema = z.object({
  location: z.string(),
  place: z.string(),
  info: ActivityInfoSchema
});

const ComprehensiveTravelSchema = z.object({
  summary: TravelInformationSchema,
  transportation: flightTool.outputSchema,
  accommodation: hotelTool.outputSchema,
  itinerary: z.array(ActivityPlanSchema),
  weatherInformation: weatherTool.outputSchema,
  recommendations: z.array(z.string()).optional()
});

// Step 1: Process Input Data (updated to include adults parameter)
const processInputStep = createStep({
  id: "process-input",
  description: "Process and validate input parameters",
  inputSchema: z.object({
    departId: z.string().min(3).describe("Departure location ID (IATA code)"),
    arrivalId: z.string().min(2).describe("Arrival location ID (IATA code)"),
    location: z.string().describe("Destination city name for hotels and activities"),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date of departure (YYYY-MM-DD)"),
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date of return (YYYY-MM-DD)"),
    maxStops: z.number().optional().default(2),
    travelers: z.number().int().positive().default(1),
    budget: z.number().positive().optional(),
    places: z.string().optional()
  }),
  outputSchema: z.object({
    processedInput: z.any(),
    duration: z.string(),
    budgetAllocation: z.object({
      flights: z.number(),
      accommodation: z.number(),
      activities: z.number(),
      miscellaneous: z.number()
    }),
    nights: z.number()
  }),
  execute: async ({ inputData }) => {
    console.log("✈️ Starting travel planning workflow...");

    const departureDate = new Date(inputData.departureDate);
    const returnDate = new Date(inputData.returnDate);
    const durationDays = Math.ceil((returnDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24));
    const nights = durationDays > 0 ? durationDays - 1 : 0;

    const budgetAllocation = inputData.budget ? {
      flights: inputData.budget * 0.4,
      accommodation: inputData.budget * 0.3,
      activities: inputData.budget * 0.2,
      miscellaneous: inputData.budget * 0.1
    } : {
      flights: 0,
      accommodation: 0,
      activities: 0,
      miscellaneous: 0
    };

    return {
      processedInput: inputData,
      duration: `${durationDays} days`,
      budgetAllocation,
      nights
    };
  }
});

// Step 2: Fetch Travel Components (updated for hotel tool changes)
const fetchTravelComponents = createStep({
  id: "fetch-components",
  description: "Fetch all travel components in parallel",
  inputSchema: processInputStep.outputSchema,
  outputSchema: z.object({
    flights: flightTool.outputSchema,
    accommodation: hotelTool.outputSchema,
    weather: weatherTool.outputSchema,
    place: placeTool.outputSchema,
    summary: TravelInformationSchema
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { processedInput, duration, budgetAllocation, nights } = inputData;
    const { departId, arrivalId, location, departureDate, returnDate, travelers, maxStops, places } = processedInput;

    // Calculate max price per night for accommodation
    const maxPricePerNight = nights > 0 
      ? budgetAllocation.accommodation / nights 
      : budgetAllocation.accommodation;

    const [flights, accommodation, weather, place] = await Promise.all([
      flightTool.execute({
        context: {
          from: departId,
          to: arrivalId,
          date: departureDate,
          travelers,
          maxStops
        },
        runtimeContext,
      }),
      hotelTool.execute({
        context: {
          location: location,
          checkInDate: departureDate,
          checkOutDate: returnDate,
          maxPrice: maxPricePerNight,
          adults: travelers
        },
        runtimeContext,
      }),
      weatherTool.execute({
        context: {
          location: location,
        },
        runtimeContext
      }),
      placeTool.execute({
        context: {
          location: location,
          type: places
        },
        runtimeContext
      })
    ]);

    // Calculate total estimated cost
    const accommodationCost = accommodation.totalPrice || (accommodation.price * nights);
    const totalCostEstimate = (processedInput.budget || 0) > 0 
  ? processedInput.budget 
  : ((flights[0]?.price || 0) + accommodationCost + budgetAllocation.activities);

   const summary = {
  destination: location,
  duration,
  totalCostEstimate,
  travelers,
  budgetAllocation: {
    ...budgetAllocation,
    accommodation: accommodationCost,
    flights: flights[0]?.price || budgetAllocation.flights
  }
};

    return {
      flights,
      accommodation,
      weather,
      place,
      summary
    };
  }
});

// Step 3: Compile Final Plan (updated to include more accommodation details)
const compileFinalPlan = createStep({
  id: "compile-plan",
  description: "Compile all components into final travel plan",
  inputSchema: fetchTravelComponents.outputSchema,
  outputSchema: ComprehensiveTravelSchema,
  execute: async ({ inputData }) => {
    const { flights, accommodation, weather, place, summary } = inputData;

    const itinerary = [{
      location: place.address,
      place: place.name,
      info: {
        address: place.address,
        postcode: place.postcode,
        email: place.email || 'N/A',
        tel: place.tel || 'N/A',
        website: place.website || undefined,
        distance: place.distance
      }
    }];

    // Enhanced recommendations based on accommodation details
    const recommendations = [
      `Don't forget to try local food in ${summary.destination}.`,
      `Pack according to weather: ${weather.conditions}`,
      accommodation.isSuperhost 
        ? `You're staying with a Superhost at ${accommodation.name}!` 
        : `Your accommodation: ${accommodation.name}`,
      accommodation.bedrooms && accommodation.bathrooms 
        ? `The property has ${accommodation.bedrooms} bedroom(s) and ${accommodation.bathrooms} bathroom(s).` 
        : ''
    ].filter(Boolean);

    return {
      summary,
      transportation: flights,
      accommodation,
      itinerary,
      weatherInformation: weather,
      recommendations
    };
  }
});

// Create the workflow
export const travelWorkflow = createWorkflow({
  id: 'travel-workflow',
  description: 'Complete travel planning from flights to activities',
  inputSchema: processInputStep.inputSchema,
  outputSchema: ComprehensiveTravelSchema
})
  .then(processInputStep)
  .then(fetchTravelComponents)
  .then(compileFinalPlan);

travelWorkflow.commit();

console.log("✅ ✈️ Travel workflow successfully registered");