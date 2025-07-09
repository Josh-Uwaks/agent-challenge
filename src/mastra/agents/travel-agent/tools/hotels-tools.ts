import { createTool } from '@mastra/core/tools';
import z from 'zod';

const hotelToolOutputSchema = z.object({
  id: z.string().describe('Unique identifier for the hotel'),
  name: z.string().describe('Name of the hotel'),
  price: z.number().describe('Price per night in USD'),
  totalPrice: z.number().optional().describe('Total price for the stay'),
  address: z.string().describe('Address of the hotel'),
  rating: z.number().min(0).max(5).optional().describe('Rating of the hotel out of 5'), // Made optional
  bedrooms: z.number().optional().describe('Number of bedrooms'),
  bathrooms: z.number().optional().describe('Number of bathrooms'),
  beds: z.number().optional().describe('Number of beds'),
  type: z.string().optional().describe('Type of accommodation'),
  isSuperhost: z.boolean().optional().describe('Whether the host is a superhost'),
  images: z.array(z.string()).optional().describe('Array of image URLs'),
  url: z.string().optional().describe('URL to the listing'),
});

export const hotelTool = createTool({
  id: 'hotel-tool',
  description: 'Hotel Tool for booking and managing hotels using Airbnb API',
  inputSchema: z.object({
    location: z.string().describe('Location of the hotel'),
    checkInDate: z.string().describe('Check-in date in YYYY-MM-DD format'),
    checkOutDate: z.string().describe('Check-out date in YYYY-MM-DD format'),
    maxPrice: z.number().optional().describe('Maximum price per night in USD'),
    adults: z.number().optional().describe('Number of adults').default(1),
  }),
  outputSchema: hotelToolOutputSchema,

  execute: async ({ context }) => {
    const { location, checkInDate, checkOutDate, maxPrice, adults } = context;
    const apiKey = process.env.RAPID_API_HOTEL;

    const headers = {
      'X-RapidAPI-Key': `${apiKey}`,
      'X-RapidAPI-Host': 'airbnb13.p.rapidapi.com',
    };

    try {
      // Calculate number of nights for potential discounts
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      const searchUrl = `https://airbnb13.p.rapidapi.com/search-location?location=${encodeURIComponent(location)}&checkin=${checkInDate}&checkout=${checkOutDate}&adults=${adults}&currency=USD`;

      const searchRes = await fetch(searchUrl, { headers });

      if (!searchRes.ok) {
        throw new Error(`Failed to fetch hotel data: ${searchRes.status} ${searchRes.statusText}`);
      }

      const searchData = await searchRes.json();

      if (searchData.error || !searchData.results || searchData.results.length === 0) {
        throw new Error(`No hotels found for "${location}"`);
      }

      // Filter results by price if maxPrice is specified
      const filteredResults = maxPrice 
        ? searchData.results.filter((hotel: any) => hotel.price?.rate <= maxPrice)
        : searchData.results;

      if (filteredResults.length === 0) {
        throw new Error(`No hotels found under $${maxPrice} per night`);
      }

      // Sort by rating (highest first) and take the best option
      const bestHotel = filteredResults.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))[0];

      // Calculate total price if priceItems are available
      let totalPrice: number | undefined;
      if (bestHotel.price?.priceItems) {
        totalPrice = bestHotel.price.priceItems.reduce((sum: number, item: any) => {
          return sum + (item.amount || 0);
        }, 0);
      }

      // Prepare the result with default values for missing fields
      const result = {
        id: bestHotel.id,
        name: bestHotel.name,
        price: bestHotel.price?.rate || 0,
        totalPrice: totalPrice,
        address: bestHotel.address || 'Address not available',
        rating: bestHotel.rating, // This can be undefined now
        bedrooms: bestHotel.bedrooms,
        bathrooms: bestHotel.bathrooms,
        beds: bestHotel.beds,
        type: bestHotel.type,
        isSuperhost: bestHotel.isSuperhost,
        images: bestHotel.images || [],
        url: bestHotel.url,
      };

      return hotelToolOutputSchema.parse(result);
    } catch (error) {
      console.error('Hotel API error:', error);
      throw new Error(`Failed to fetch hotel details: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});