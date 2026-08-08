#!/bin/zsh

cd "$(dirname "$0")" || exit 1

echo "Starting ActionHQ at http://localhost:3002"
echo
npm run dev
launch_status=$?

if (( launch_status != 0 )); then
  echo
  echo "ActionHQ could not start. Keep this window open and copy the error shown above."
  read "reply?Press Return to close this window."
fi

exit "$launch_status"
