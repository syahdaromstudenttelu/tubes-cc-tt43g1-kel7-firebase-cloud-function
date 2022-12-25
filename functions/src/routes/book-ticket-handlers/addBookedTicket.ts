import * as express from 'express';
import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { nanoid } from 'nanoid';
import type { CitiesCodeIdn } from '../../lib/citiesCodeIdn.js';
import { citiesCodeIdn } from '../../lib/citiesCodeIdn.js';
import { BookingError } from '../../lib/error-class/BookingError.js';

type TicketShifts = 'morning' | 'afternoon';
type SitPos = '1' | '2' | '3' | '4' | '5';

interface FirebaseAuthError {
  code: string;
  message: string;
  name: string;
}

interface BookTicketReqBodyProps {
  uidToken: string;
  bookTo: string;
  bookFrom: string;
  bookDate: string;
  bookShift: TicketShifts;
  bookSitPos: SitPos;
  bookPassangerName: string;
  bookPassangerPhone: string;
  bookTotalPayment: number;
}

interface TicketAvailabilityProps {
  allBooked: boolean;
  shifts: {
    morning: {
      allBooked: boolean;
      bookedSits: {
        '1': boolean;
        '2': boolean;
        '3': boolean;
        '4': boolean;
        '5': boolean;
      };
    };
    afternoon: {
      allBooked: boolean;
      bookedSits: {
        '1': boolean;
        '2': boolean;
        '3': boolean;
        '4': boolean;
        '5': boolean;
      };
    };
  };
}

interface BookTicketsDocProps {
  [ticketDate: string]: {
    ticketAvailability: TicketAvailabilityProps;
  };
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

const createInitBookTicketDate = ({ bookDate }: { bookDate: string }) => ({
  [bookDate]: {
    ticketAvailability: {
      allBooked: false,
      shifts: {
        morning: {
          allBooked: false,
          bookedSits: {
            '1': false,
            '2': false,
            '3': false,
            '4': false,
            '5': false,
          },
        },
        afternoon: {
          allBooked: false,
          bookedSits: {
            '1': false,
            '2': false,
            '3': false,
            '4': false,
            '5': false,
          },
        },
      },
    },
  },
});

const bookTicketValidator = (bookTicketData: BookTicketReqBodyProps) => {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  const currentDateMs = currentDate.getTime();
  const bookTicketDate = new Date(bookTicketData.bookDate);
  bookTicketDate.setHours(0, 0, 0, 0);
  const bookTicketDateMs = bookTicketDate.getTime();

  if (bookTicketDateMs - currentDateMs < 0)
    throw new BookingError(
      'Cannot booking ticket with previous date with start from current date',
      'book-ticket/previous-date'
    );
};

export const addBookedTicket = async (
  req: functions.https.Request,
  res: express.Response
) => {
  try {
    const bookTicketReqBody: BookTicketReqBodyProps = req.body;
    const { uidToken, ...userBookTicketInput } = bookTicketReqBody;

    bookTicketValidator(bookTicketReqBody);

    const verifiedUser = await admin.auth().verifyIdToken(uidToken);

    const bookTicketsRef = admin
      .firestore()
      .collection('bookTickets')
      .doc(
        `${citiesCodeIdn[userBookTicketInput.bookFrom as CitiesCodeIdn]}_${
          citiesCodeIdn[userBookTicketInput.bookTo as CitiesCodeIdn]
        }`
      );

    const usersBookedTicketsRef = admin
      .firestore()
      .collection('usersBookedTickets')
      .doc(verifiedUser.uid);

    const bookTicketsCodeDstDoc = await bookTicketsRef.get();

    const ticketId = nanoid(22);

    if (bookTicketsCodeDstDoc.exists === false) {
      const initialBookTicketDate: BookTicketsDocProps =
        createInitBookTicketDate({
          bookDate: userBookTicketInput.bookDate,
        });

      initialBookTicketDate[
        userBookTicketInput.bookDate
      ].ticketAvailability.shifts[userBookTicketInput.bookShift].bookedSits[
        userBookTicketInput.bookSitPos
      ] = true;

      await bookTicketsRef.set(initialBookTicketDate, { merge: true });

      const userBookedTicketData: UserBookedTicketProps = {
        ticketId,
        ...userBookTicketInput,
        paidOff: false,
      };

      await usersBookedTicketsRef.set(
        {
          [ticketId]: userBookedTicketData,
        },
        { merge: true }
      );
    } else {
      const bookTicketSnapshot =
        bookTicketsCodeDstDoc.data() as BookTicketsDocProps;

      const bookTicketDate = bookTicketSnapshot[userBookTicketInput.bookDate];

      if (bookTicketDate === undefined) {
        const initialBookTicketDate: BookTicketsDocProps =
          createInitBookTicketDate({
            bookDate: userBookTicketInput.bookDate,
          });

        initialBookTicketDate[
          userBookTicketInput.bookDate
        ].ticketAvailability.shifts[userBookTicketInput.bookShift].bookedSits[
          userBookTicketInput.bookSitPos
        ] = true;

        await bookTicketsRef.set(initialBookTicketDate, {
          merge: true,
        });

        const userBookedTicketData: UserBookedTicketProps = {
          ticketId,
          ...userBookTicketInput,
          paidOff: false,
        };

        await usersBookedTicketsRef.set(
          {
            [ticketId]: userBookedTicketData,
          },
          { merge: true }
        );
      } else {
        const dateIsBooked =
          bookTicketSnapshot[userBookTicketInput.bookDate].ticketAvailability
            .allBooked;

        const shiftIsBooked =
          bookTicketSnapshot[userBookTicketInput.bookDate].ticketAvailability
            .shifts[userBookTicketInput.bookShift as TicketShifts].allBooked;

        const sitIsBooked =
          bookTicketSnapshot[userBookTicketInput.bookDate].ticketAvailability
            .shifts[userBookTicketInput.bookShift as TicketShifts].bookedSits[
            userBookTicketInput.bookSitPos
          ];

        if (dateIsBooked) {
          throw new BookingError(
            'Booking date is full',
            'book-ticket/date-booked'
          );
        }

        if (shiftIsBooked) {
          throw new BookingError(
            'Booking shift is full',
            'book-ticket/shift-booked'
          );
        }

        if (sitIsBooked) {
          throw new BookingError(
            'Sit position is already booked',
            'book-ticket/sit-booked'
          );
        }

        const bookTicketDates = {
          ...(bookTicketsCodeDstDoc.data() as BookTicketsDocProps),
        };

        bookTicketDates[userBookTicketInput.bookDate].ticketAvailability.shifts[
          userBookTicketInput.bookShift as TicketShifts
        ].bookedSits[userBookTicketInput.bookSitPos] = true;

        const bookTicketSits = {
          ...bookTicketDates[userBookTicketInput.bookDate].ticketAvailability
            .shifts[userBookTicketInput.bookShift as TicketShifts].bookedSits,
        };

        for (const ticketSitPos in bookTicketSits) {
          if (bookTicketSits[ticketSitPos as SitPos]) {
            bookTicketDates[
              userBookTicketInput.bookDate
            ].ticketAvailability.shifts[
              userBookTicketInput.bookShift
            ].allBooked = true;
          } else {
            bookTicketDates[
              userBookTicketInput.bookDate
            ].ticketAvailability.shifts[
              userBookTicketInput.bookShift
            ].allBooked = false;
            break;
          }
        }

        const bookTicketShifts = {
          ...bookTicketDates[userBookTicketInput.bookDate].ticketAvailability
            .shifts,
        };

        for (const ticketShift in bookTicketShifts) {
          if (bookTicketShifts[ticketShift as TicketShifts].allBooked) {
            bookTicketDates[
              userBookTicketInput.bookDate
            ].ticketAvailability.allBooked = true;
          } else {
            bookTicketDates[
              userBookTicketInput.bookDate
            ].ticketAvailability.allBooked = false;
            break;
          }
        }

        await bookTicketsRef.set(bookTicketDates, { merge: true });

        const userBookedTicketData: UserBookedTicketProps = {
          ticketId,
          ...userBookTicketInput,
          paidOff: false,
        };

        await usersBookedTicketsRef.set(
          {
            [ticketId]: userBookedTicketData,
          },
          { merge: true }
        );
      }
    }

    res.statusCode = 201;
    res.json({
      status: 'success',
      data: {
        ticketId,
      },
    });
  } catch (error) {
    if ((error as FirebaseAuthError).code === 'auth/argument-error') {
      res.statusCode = 401;
      res.json({
        status: 'failed',
        message: 'Invalid User Id Token',
      });
    }

    if (
      error instanceof BookingError &&
      error.code === 'book-ticket/previous-date'
    ) {
      res.statusCode = 400;
      res.json({
        status: 'failed',
        message: error.message,
        errorCaused: 'previous-date',
      });
    }

    if (
      error instanceof BookingError &&
      error.code === 'book-ticket/date-booked'
    ) {
      res.statusCode = 409;
      res.json({
        status: 'failed',
        message: error.message,
        errorCaused: 'date',
      });
    }

    if (
      error instanceof BookingError &&
      error.code === 'book-ticket/shift-booked'
    ) {
      res.statusCode = 409;
      res.json({
        status: 'failed',
        message: error.message,
        errorCaused: 'shift',
      });
    }

    if (
      error instanceof BookingError &&
      error.code === 'book-ticket/sit-booked'
    ) {
      res.statusCode = 409;
      res.json({
        status: 'failed',
        message: error.message,
        errorCaused: 'sit',
      });
    }
  }
};
