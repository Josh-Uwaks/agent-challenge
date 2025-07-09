import { createTool } from '@mastra/core/tools';
import z from 'zod';

// Schema for a single flight
const singleFlightSchema = z.object({
  departureTime: z.string().describe('Departure time in ISO format'),
  price: z.number().describe('Price of the flight in USD'),
  airline: z.string().describe('Airline name'),
  arrivalTime: z.string().describe('Arrival time in ISO format'),
  duration: z.string().describe('Total duration of the flight (e.g. "5h 30m")'),
  stops: z.number().describe('Number of stops'),
  bookingToken: z.string().optional().describe('Token used for booking this flight (if available)'),
});

// Schema for multiple flights (array of the above)
const flightToolOutputSchema = z.array(singleFlightSchema);

// Tool definition
export const flightTool = createTool({
  id: 'flight-tool',
  description: 'Flight Tool for booking and managing one-way flights',
  inputSchema: z.object({
    from: z.string().describe('IATA code of departure airport (e.g. JFK)'),
    to: z.string().describe('IATA code of arrival airport (e.g. LOS)'),
    date: z.string().describe('Flight date in YYYY-MM-DD format'),
    travelers: z.number().optional().default(1).describe('Number of travelers'),
    maxStops: z.number().optional().default(2).describe('Maximum number of stops allowed'),
    budget: z.number().optional().describe('Maximum budget per traveler in USD'),
  }),
  outputSchema: flightToolOutputSchema,
  execute: async ({ context }) => {
    const { from, to, date, travelers, maxStops, budget } = context;

    const apiKey = process.env.RAPID_API_FLIGHT;
    if (!apiKey) {
      throw new Error('Missing RAPID_API_FLIGHT in environment variables');
    }

    const url = `https://booking-com18.p.rapidapi.com/flights/v2/search-oneway?departId=${from}&arrivalId=${to}&departDate=${date}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'booking-com18.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        throw new Error(`Flight API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const offers = data.data?.flightOffers || [];

      const flights = offers.map((offer: any) => {
        const segments = offer.segments;
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
        const leg = firstSegment.legs[0];

        const airline = leg.carriersData?.[0]?.name || 'Unknown Airline';

        const totalSeconds = firstSegment.totalTime || 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const duration = `${hours}h ${minutes}m`;

        const stops = firstSegment.legs.length - 1;

        const priceUnits = offer.priceBreakdown?.total?.units || 0;
        const priceNanos = offer.priceBreakdown?.total?.nanos || 0;
        const totalPrice = priceUnits + priceNanos / 1e9;
        const pricePerTraveler = totalPrice / travelers;

        return {
          airline,
          price: parseFloat(pricePerTraveler.toFixed(2)),
          departureTime: firstSegment.departureTime,
          arrivalTime: lastSegment.arrivalTime,
          duration,
          stops,
          bookingToken: offer.token,
        };
      })
        .filter((flight: any) => flight.stops <= maxStops)
        .filter((flight: any) => !budget || flight.price <= budget)
        .sort((a: any, b: any) => a.price - b.price);

      if (flights.length === 0) {
        throw new Error('No flights found matching your criteria.');
      }

      return flightToolOutputSchema.parse(flights);
    } catch (error) {
      console.error('Flight API error:', error);
      throw new Error(`Failed to fetch flight details: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
