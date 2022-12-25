import admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();

export { bookedTickets } from './routes/bookedTickets.js';
export { bookTicket } from './routes/bookTicket.js';

export const helloWorld = functions.https.onRequest((request, response) => {
  response.json({
    status: 'success',
  });
});
