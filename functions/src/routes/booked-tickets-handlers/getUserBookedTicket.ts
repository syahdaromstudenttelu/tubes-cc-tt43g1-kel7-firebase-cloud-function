import * as express from 'express';
import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { capitalize } from 'radash';

type TicketShifts = 'morning' | 'afternoon';
type SitPos = '1' | '2' | '3' | '4' | '5';

interface FirebaseAuthError {
  code: string;
  message: string;
  name: string;
}

interface UserBookedTicketProps {
  ticketId: string;
  bookFrom: string;
  bookTo: string;
  bookDate: string;
  bookShift: TicketShifts;
  bookSitPos: SitPos;
  bookPassangerName: string;
  bookPassangerPhone: string;
  bookTotalPayment: number;
  paidOff: boolean;
}

interface UserBookedTicketsDocProps {
  [ticketId: string]: UserBookedTicketProps;
}

export const getUserBookedTickets = async (
  req: functions.https.Request,
  res: express.Response
) => {
  try {
    const { uidToken } = req.query;

    const verifiedUser = await admin.auth().verifyIdToken(uidToken as string);

    const usersBookedTicketsRef = admin
      .firestore()
      .collection('usersBookedTickets')
      .doc(verifiedUser.uid);

    const userBookedTicketsSnapshot = await usersBookedTicketsRef.get();

    const userBookedTicketsData =
      userBookedTicketsSnapshot.data() as UserBookedTicketsDocProps;

    const responseData = [];

    for (const userBookedTicketId in userBookedTicketsData) {
      if (
        Object.prototype.hasOwnProperty.call(
          userBookedTicketsData,
          userBookedTicketId
        )
      ) {
        const userBookedTicketData = userBookedTicketsData[userBookedTicketId];

        responseData.push({
          ticketId: userBookedTicketData.ticketId,
          bookedDate: userBookedTicketData.bookDate,
          bookedShift: userBookedTicketData.bookShift,
          destination: {
            to: capitalize(userBookedTicketData.bookTo),
            from: capitalize(userBookedTicketData.bookFrom),
          },
          sitPos: userBookedTicketData.bookSitPos,
          passangerName: userBookedTicketData.bookPassangerName,
          passangerPhone: userBookedTicketData.bookPassangerPhone,
          totalPayment: userBookedTicketData.bookTotalPayment,
          paidOff: userBookedTicketData.paidOff,
        });
      }
    }

    res.status(200);
    res.json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    if ((error as FirebaseAuthError).code === 'auth/argument-error') {
      res.statusCode = 401;
      res.json({
        status: 'failed',
        message: 'Invalid User Id Token',
      });
    }
  }
};
