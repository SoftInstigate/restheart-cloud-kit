#!/bin/sh
npx vite preview --outDir test-results --port 5050 &
sleep 1
open http://localhost:5050
