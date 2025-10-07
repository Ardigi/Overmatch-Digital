// Mock Twilio client
const mockMessage = {
  sid: 'SM1234567890abcdef',
  status: 'sent',
  dateCreated: new Date(),
  dateSent: new Date(),
  price: '-0.00750',
  priceUnit: 'USD',
  errorCode: null,
  errorMessage: null,
};

const mockMessages = {
  create: jest.fn().mockResolvedValue(mockMessage),
  get: jest.fn().mockReturnValue({
    fetch: jest.fn().mockResolvedValue(mockMessage),
  }),
};

const mockLookups = {
  v1: {
    phoneNumbers: jest.fn().mockReturnValue({
      fetch: jest.fn().mockResolvedValue({
        phoneNumber: '+1234567890',
        nationalFormat: '(123) 456-7890',
        countryCode: 'US',
        valid: true,
      }),
    }),
  },
};

const mockTwilioClient = {
  messages: mockMessages,
  lookups: mockLookups,
};

// Mock the default export (the Twilio constructor)
const twilio = jest.fn().mockReturnValue(mockTwilioClient);

// Add the mock client as a property for direct access in tests
(twilio as any).mockClient = mockTwilioClient;
(twilio as any).mockMessage = mockMessage;

// Export types
export interface MessageInstance {
  sid: string;
  status: string;
  dateCreated: Date;
  dateSent: Date;
  price: string;
  priceUnit: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export { Twilio } from 'twilio';

export default twilio;
