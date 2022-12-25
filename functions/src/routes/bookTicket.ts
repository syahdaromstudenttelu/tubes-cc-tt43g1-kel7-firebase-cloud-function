import cors from 'cors';
import * as functions from 'firebase-functions';
import { addBookedTicket } from './book-ticket-handlers/addBookedTicket.js';
import { getTicketsAvailability } from './book-ticket-handlers/getTicketsAvailability.js';
import { updatePaidTicket } from './book-ticket-handlers/updatePaidTicket.js';

const corsApp = cors({
  origin: ['https://tubes-cc-tt43g1-kel7-web.vercel.app'],
});

export const bookTicket = functions.https.onRequest((req, res) => {
  corsApp(req, res, async () => {
    if (req.method === 'POST') {
      await addBookedTicket(req, res);
    } else if (req.method === 'GET') {
      await getTicketsAvailability(req, res);
    } else if (req.method === 'PATCH') {
      await updatePaidTicket(req, res);
    } else {
      res.status(400);
      res.json({
        status: 'failed',
        message: 'Invalid HTTP method',
      });
    }
  });
});
