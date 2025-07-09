import { createTool } from '@mastra/core/tools';
import z from 'zod';

// Output Schema
const placeToolOutputSchema = z.object({
  name: z.string().describe('Name of the place'),
  address: z.string().describe('Address of the place'),
  email: z.string().email().optional().describe('Email address of the place (if available)'),
  tel: z.string().optional().describe('Telephone number of the place (if available)'),
  postcode: z.string(),
  website: z.string().optional(),
  distance: z.number()
});

export const placeTool = createTool({
  id: 'find-place',
  description: 'Tool for finding places like restaurants, attractions, etc. using Foursquare API.',
  inputSchema: z.object({
    location: z.string().describe('Location to search for places, e.g. "Chicago"'),
    type: z.string().optional().describe('Type of place, e.g. "coffee", "restaurant", "museum"'),
  }),
  outputSchema: placeToolOutputSchema,
  execute: async ({ context }) => {
    const { location, type } = context;

    // Validate required parameters
    if (!location) {
      const errorMsg = 'Location parameter is required';
      console.error('❌ Error:', errorMsg);
      throw new Error(errorMsg);
    }

    const apiKey = process.env.FOURSQUARE_API_KEY;
    if (!apiKey) {
      const errorMsg = 'FOURSQUARE_API_KEY is not set in environment variables';
      console.error('❌ Error:', errorMsg);
      throw new Error(errorMsg);
    }

    // Prepare query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('near', location);
    if (type) {
      queryParams.append('query', type);
      console.log(`🔍 Searching for ${type} places in ${location}...`);
    } else {
      console.log(`🔍 Searching for places in ${location}...`);
    }

    try {
      const url = `https://places-api.foursquare.com/places/search?${queryParams.toString()}`;
      console.debug('API Request URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Places-Api-Version': '2025-06-17',
        }
      });

      const data = await response.json();
      console.debug('API Response:', JSON.stringify(data, null, 2));

      const firstResult = data.results?.[0];
      if (!firstResult) {
        const errorMsg = type 
          ? `No ${type} places found in ${location}`
          : `No places found in ${location}`;
        console.warn('⚠️ Warning:', errorMsg);
        throw new Error(errorMsg);
      }

      const mappedData = {
        name: firstResult.name,
        address:
          firstResult.location?.formatted_address ||
          `${firstResult.location?.address}, ${firstResult.location?.locality}`,
        email: firstResult.email || undefined,
        tel: firstResult.tel || undefined,
        postcode: firstResult.location?.postcode || '',
        website: firstResult.website || undefined,
        distance: firstResult.distance ?? 0,
      };

      const validatedData = placeToolOutputSchema.parse(mappedData);
      
      console.log('✅ Successfully found place:', {
        name: validatedData.name,
        type: type || 'various',
        address: validatedData.address,
        distance: `${validatedData.distance}m away`
      });

      return validatedData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Operation failed:', errorMsg);
      
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
      }
      
      throw new Error(`Failed to fetch place details: ${errorMsg}`);
    }
  },
});
