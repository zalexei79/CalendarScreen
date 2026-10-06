# Entry and demo calendar

Unauthenticated visitors first see Google and Telegram sign-in and “Посмотреть без входа”. Existing sessions open the app directly. The existing language/currency introduction follows sign-in or the demo choice.

Demo mode displays seven examples in the current month: salary +777, freelance +67, groceries −69, cafe −7, music subscription −12, housing −240 and transport −7. Examples follow the selected currency (USD by default) and have translated comments. Calendar and History share these display-only records. They are never written to local trade caches, sync queues or Supabase and disappear when a real account opens.

Adding an entry asks for Google or Telegram before showing the form. The selected date survives the OAuth redirect in session storage, and the form opens after profile setup. Closing the sign-in dialog cancels this intent. Demo browsing survives a tab reload; a new tab begins with the sign-in screen.
