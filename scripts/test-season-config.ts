/**
 * Test script for season-config.ts
 * Validates season mapping and thermal multiplier logic
 */

import { Hemisphere, ProductSeason, ThermalClass } from '@prisma/client';
import {
  getSeasonContext,
  getSeasonThermalMultiplier,
} from '../lib/game/season/season-config';

/**
 * Test dates covering different seasons and edge cases
 */
const TEST_DATES = [
  '2025-09-16', // NORTH: EARLY_FW, SOUTH: EARLY_SS
  '2025-12-10', // NORTH: CORE_WINTER, SOUTH: CORE_SUMMER
  '2026-02-20', // NORTH: LATE_FW, SOUTH: CORE_SUMMER
  '2026-03-10', // NORTH: Overlap zone (EARLY_SS wins), SOUTH: EARLY_FW
  '2026-07-15', // NORTH: CORE_SUMMER, SOUTH: LATE_FW
];

/**
 * Test hemispheres
 */
const TEST_HEMISPHERES: Hemisphere[] = ['NORTH', 'SOUTH'];

/**
 * Test phase shifts
 */
const TEST_SHIFTS = [0, 2, -2];

/**
 * Sample thermal classes for multiplier testing
 */
const THERMAL_CLASSES: ThermalClass[] = ['HOT', 'WARM', 'MILD', 'COOL', 'COLD'];

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return dateStr;
}

/**
 * Print a divider
 */
function printDivider(char = '=', length = 80) {
  console.log(char.repeat(length));
}

/**
 * Print section header
 */
function printHeader(title: string) {
  printDivider();
  console.log(`  ${title}`);
  printDivider();
}

/**
 * Test 1: Season context mapping for all combinations
 */
function testSeasonContext() {
  printHeader('TEST 1: Season Context Mapping');
  console.log();

  for (const hemisphere of TEST_HEMISPHERES) {
    console.log(`\n🌍 HEMISPHERE: ${hemisphere}`);
    console.log('-'.repeat(80));

    for (const shift of TEST_SHIFTS) {
      const shiftLabel = shift === 0 ? 'No Shift' : `${shift > 0 ? '+' : ''}${shift} weeks`;
      console.log(`\n  Phase Shift: ${shiftLabel}`);
      console.log('  ' + '-'.repeat(76));

      console.log(
        `  ${'Date'.padEnd(12)} | ${'Active Season'.padEnd(14)} | ${'Phase'.padEnd(12)}`
      );
      console.log('  ' + '-'.repeat(76));

      for (const date of TEST_DATES) {
        const ctx = getSeasonContext(date, hemisphere, shift);
        console.log(
          `  ${formatDate(date).padEnd(12)} | ${ctx.activeSeason.padEnd(14)} | ${ctx.phase.padEnd(12)}`
        );
      }
    }
  }
  console.log('\n');
}

/**
 * Test 2: Thermal multiplier calculations
 */
function testThermalMultipliers() {
  printHeader('TEST 2: Thermal Multiplier Calculations');
  console.log();

  // Test specific date for each hemisphere
  const testCases = [
    { date: '2025-12-10', hemisphere: 'NORTH' as Hemisphere, desc: 'NORTH CORE_WINTER' },
    { date: '2026-07-15', hemisphere: 'NORTH' as Hemisphere, desc: 'NORTH CORE_SUMMER' },
    { date: '2025-12-10', hemisphere: 'SOUTH' as Hemisphere, desc: 'SOUTH CORE_SUMMER' },
    { date: '2026-07-15', hemisphere: 'SOUTH' as Hemisphere, desc: 'SOUTH LATE_FW' },
  ];

  // Valid thermal classes for each season
  const validWinterClasses = ['MILD', 'COOL', 'COLD'];
  const validSummerClasses = ['HOT', 'WARM', 'MILD'];

  for (const testCase of testCases) {
    console.log(`\n📊 ${testCase.desc} (${testCase.date})`);
    console.log('-'.repeat(80));

    const ctx = getSeasonContext(testCase.date, testCase.hemisphere);
    console.log(`   Context: activeSeason=${ctx.activeSeason}, phase=${ctx.phase}\n`);

    // Test WINTER products
    console.log('   WINTER Products:');
    console.log(
      `   ${'Thermal Class'.padEnd(15)} | ${'Multiplier'.padEnd(12)} | ${'Status'.padEnd(20)}`
    );
    console.log('   ' + '-'.repeat(74));

    for (const thermalClass of THERMAL_CLASSES) {
      const mult = getSeasonThermalMultiplier(ctx, 'WINTER', thermalClass);
      const isValidClass = validWinterClasses.includes(thermalClass);
      const status =
        mult === 0.08
          ? (ctx.activeSeason !== 'WINTER' ? 'CROSS-SEASON' : 'INVALID_CLASS')
          : mult === 1.0
          ? 'OPTIMAL'
          : mult > 0.5
          ? 'GOOD'
          : 'POOR';
      console.log(
        `   ${thermalClass.padEnd(15)} | ${mult.toFixed(2).padEnd(12)} | ${status.padEnd(20)}`
      );
    }

    // Test SUMMER products
    console.log('\n   SUMMER Products:');
    console.log(
      `   ${'Thermal Class'.padEnd(15)} | ${'Multiplier'.padEnd(12)} | ${'Status'.padEnd(20)}`
    );
    console.log('   ' + '-'.repeat(74));

    for (const thermalClass of THERMAL_CLASSES) {
      const mult = getSeasonThermalMultiplier(ctx, 'SUMMER', thermalClass);
      const isValidClass = validSummerClasses.includes(thermalClass);
      const status =
        mult === 0.08
          ? (ctx.activeSeason !== 'SUMMER' ? 'CROSS-SEASON' : 'INVALID_CLASS')
          : mult === 1.0
          ? 'OPTIMAL'
          : mult > 0.5
          ? 'GOOD'
          : 'POOR';
      console.log(
        `   ${thermalClass.padEnd(15)} | ${mult.toFixed(2).padEnd(12)} | ${status.padEnd(20)}`
      );
    }
  }
  console.log('\n');
}

/**
 * Test 3: Overlap zone validation
 */
function testOverlapZones() {
  printHeader('TEST 3: Overlap Zone Validation');
  console.log();

  console.log('Testing that EARLY_SS takes precedence in overlap zones:\n');

  // NORTH overlap: Mar 5-15
  console.log('🌍 NORTH Hemisphere (Mar 5-15):');
  console.log('-'.repeat(80));
  console.log(`${'Date'.padEnd(12)} | ${'Expected'.padEnd(12)} | ${'Actual'.padEnd(12)} | ${'Result'.padEnd(10)}`);
  console.log('-'.repeat(80));

  const northOverlapDates = ['2026-03-05', '2026-03-10', '2026-03-15'];
  for (const date of northOverlapDates) {
    const ctx = getSeasonContext(date, 'NORTH');
    const expected = 'EARLY_SS';
    const result = ctx.phase === expected ? '✓ PASS' : '✗ FAIL';
    console.log(
      `${date.padEnd(12)} | ${expected.padEnd(12)} | ${ctx.phase.padEnd(12)} | ${result.padEnd(10)}`
    );
  }

  console.log();

  // SOUTH overlap: Aug 5-15
  console.log('🌍 SOUTH Hemisphere (Aug 5-15):');
  console.log('-'.repeat(80));
  console.log(`${'Date'.padEnd(12)} | ${'Expected'.padEnd(12)} | ${'Actual'.padEnd(12)} | ${'Result'.padEnd(10)}`);
  console.log('-'.repeat(80));

  const southOverlapDates = ['2026-08-05', '2026-08-10', '2026-08-15'];
  for (const date of southOverlapDates) {
    const ctx = getSeasonContext(date, 'SOUTH');
    const expected = 'EARLY_SS';
    const result = ctx.phase === expected ? '✓ PASS' : '✗ FAIL';
    console.log(
      `${date.padEnd(12)} | ${expected.padEnd(12)} | ${ctx.phase.padEnd(12)} | ${result.padEnd(10)}`
    );
  }

  console.log('\n');
}

/**
 * Test 4: Cross-season penalty validation
 */
function testCrossSeasonPenalty() {
  printHeader('TEST 4: Cross-Season Penalty Validation');
  console.log();

  console.log('Verifying 0.08 penalty for products sold in wrong season:\n');

  const testDate = '2025-12-10'; // NORTH: CORE_WINTER
  const ctx = getSeasonContext(testDate, 'NORTH');

  console.log(`Context: ${testDate} (${ctx.activeSeason} - ${ctx.phase})\n`);

  console.log(
    `${'Product Season'.padEnd(15)} | ${'Thermal Class'.padEnd(15)} | ${'Multiplier'.padEnd(12)} | ${'Expected'.padEnd(10)}`
  );
  console.log('-'.repeat(80));

  // Test wrong season products (SUMMER during WINTER)
  for (const thermalClass of ['HOT', 'WARM', 'MILD'] as ThermalClass[]) {
    const mult = getSeasonThermalMultiplier(ctx, 'SUMMER', thermalClass);
    const expected = 0.08;
    const result = mult === expected ? '✓' : '✗';
    console.log(
      `${'SUMMER'.padEnd(15)} | ${thermalClass.padEnd(15)} | ${mult.toFixed(2).padEnd(12)} | ${expected.toFixed(2)} ${result}`
    );
  }

  console.log('\n');
}

/**
 * Test 5: Date input format validation
 */
function testDateInputFormats() {
  printHeader('TEST 5: Date Input Format Validation');
  console.log();

  console.log('Testing both string and Date object inputs:\n');

  const dateStr = '2025-12-10';
  const dateObj = new Date(Date.UTC(2025, 11, 10, 0, 0, 0, 0));

  const ctx1 = getSeasonContext(dateStr, 'NORTH');
  const ctx2 = getSeasonContext(dateObj, 'NORTH');

  console.log(`String input ("${dateStr}"):        ${ctx1.activeSeason} - ${ctx1.phase}`);
  console.log(`Date object input (same date): ${ctx2.activeSeason} - ${ctx2.phase}`);
  console.log(
    `\nResult: ${ctx1.activeSeason === ctx2.activeSeason && ctx1.phase === ctx2.phase ? '✓ PASS - Both formats produce same result' : '✗ FAIL - Formats produce different results'}`
  );

  console.log('\n');
}

/**
 * Test 6: EQUATOR fallback validation
 */
function testEquatorFallback() {
  printHeader('TEST 6: EQUATOR Fallback Validation');
  console.log();

  console.log('MVP: EQUATOR uses NORTH calendar as fallback\n');

  const testDate = '2025-12-10';
  const ctxNorth = getSeasonContext(testDate, 'NORTH');
  const ctxEquator = getSeasonContext(testDate, 'EQUATOR');

  console.log(
    `${'Hemisphere'.padEnd(12)} | ${'Active Season'.padEnd(15)} | ${'Phase'.padEnd(12)}`
  );
  console.log('-'.repeat(50));
  console.log(`${'NORTH'.padEnd(12)} | ${ctxNorth.activeSeason.padEnd(15)} | ${ctxNorth.phase.padEnd(12)}`);
  console.log(
    `${'EQUATOR'.padEnd(12)} | ${ctxEquator.activeSeason.padEnd(15)} | ${ctxEquator.phase.padEnd(12)}`
  );

  const result =
    ctxNorth.activeSeason === ctxEquator.activeSeason && ctxNorth.phase === ctxEquator.phase
      ? '✓ PASS'
      : '✗ FAIL';
  console.log(`\nResult: ${result} - EQUATOR matches NORTH`);

  console.log('\n');
}

/**
 * Test 7: Invalid thermal class validation
 */
function testInvalidThermalClasses() {
  printHeader('TEST 7: Invalid Thermal Class Validation');
  console.log();
  console.log('Verifying 0.08 penalty for invalid thermal classes:\n');

  const winterCtx = getSeasonContext('2025-12-10', 'NORTH'); // CORE_WINTER
  const summerCtx = getSeasonContext('2026-07-15', 'NORTH'); // CORE_SUMMER

  console.log('WINTER context + invalid classes (HOT, WARM):');
  console.log(`${'Thermal Class'.padEnd(15)} | ${'Multiplier'.padEnd(12)} | ${'Expected'.padEnd(10)} | Result`);
  console.log('-'.repeat(65));
  
  for (const cls of ['HOT', 'WARM'] as ThermalClass[]) {
    const mult = getSeasonThermalMultiplier(winterCtx, 'WINTER', cls);
    const result = mult === 0.08 ? '✓' : '✗';
    console.log(`${cls.padEnd(15)} | ${mult.toFixed(2).padEnd(12)} | ${'0.08'.padEnd(10)} | ${result}`);
  }

  console.log('\nSUMMER context + invalid classes (COOL, COLD):');
  console.log(`${'Thermal Class'.padEnd(15)} | ${'Multiplier'.padEnd(12)} | ${'Expected'.padEnd(10)} | Result`);
  console.log('-'.repeat(65));
  
  for (const cls of ['COOL', 'COLD'] as ThermalClass[]) {
    const mult = getSeasonThermalMultiplier(summerCtx, 'SUMMER', cls);
    const result = mult === 0.08 ? '✓' : '✗';
    console.log(`${cls.padEnd(15)} | ${mult.toFixed(2).padEnd(12)} | ${'0.08'.padEnd(10)} | ${result}`);
  }

  console.log('\n');
}

/**
 * Main test runner
 */
function runAllTests() {
  console.log('\n');
  printDivider('█');
  console.log('  ModaVerse V02 Season Config Test Suite');
  printDivider('█');
  console.log('\n');

  testSeasonContext();
  testThermalMultipliers();
  testOverlapZones();
  testCrossSeasonPenalty();
  testDateInputFormats();
  testEquatorFallback();
  testInvalidThermalClasses();

  printDivider('█');
  console.log('  All Tests Complete');
  printDivider('█');
  console.log('\n');
}

// Run tests
runAllTests();
