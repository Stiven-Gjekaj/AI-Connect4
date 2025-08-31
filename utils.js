// utils.js - Helper functions used across the app
(function(global){
  'use strict';

  function cloneBoard(board){
    // Deep clone 2D array [rows][cols]
    return board.map(row => row.slice());
  }

  function sleep(ms){
    return new Promise(res => setTimeout(res, ms));
  }

  function randomChoice(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function range(n){
    return Array.from({length: n}, (_, i) => i);
  }

  global.C4Utils = { cloneBoard, sleep, randomChoice, range };
})(window);

