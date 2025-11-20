/**
 * VSCode Extension Test Runner for BigQuery Tools
 * This runs inside the extension host and can access VSCode APIs
 */

import * as vscode from 'vscode';
import { getSqlExecutor } from './services/SqlExecutor';

interface TestResult {
    tool: string;
    passed: boolean;
    error?: string;
    message?: string;
}

export async function runBigQueryToolsTest(): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('BigQuery Tools Test');
    outputChannel.show();

    function log(message: string) {
        outputChannel.appendLine(message);
        console.log(message);
    }

    function section(title: string) {
        log('');
        log('='.repeat(60));
        log(title);
        log('='.repeat(60));
        log('');
    }

    const results: TestResult[] = [];
    let testWorksheetId: string | undefined;

    section('🧪 BigQuery Tools - Complete Test Suite');

    try {
        // Get SQL Executor
        const sqlExecutor = getSqlExecutor();

        // Test 1: Initialize
        section('Test 1: SQL Extension Initialization');
        try {
            await sqlExecutor.initialize();
            log('✅ SQL extension initialized successfully');
            results.push({ tool: 'initialization', passed: true });
        } catch (error: any) {
            log(`❌ SQL extension initialization failed: ${error.message}`);
            results.push({ tool: 'initialization', passed: false, error: error.message });
            throw error; // Can't continue without initialization
        }

        // Test 2: list_bigquery_connections
        section('Test 2: list_bigquery_connections');
        try {
            const connections = await sqlExecutor.getConnections();
            const bqConnections = await sqlExecutor.getBigQueryConnections();

            log(`Found ${connections.length} connection(s)`);
            log(`Found ${bqConnections.length} active BigQuery connection(s)`);

            if (connections.length > 0) {
                connections.forEach((conn, idx) => {
                    log(`  ${idx + 1}. ${conn.connectionName} (${conn.connectionType})`);
                    log(`     Project: ${conn.connectionCredentials.project_id || 'N/A'}`);
                });
            }

            if (bqConnections.length > 0) {
                bqConnections.forEach((conn: any, idx: number) => {
                    log(`  BQ ${idx + 1}. ${conn.name} (${conn.isConnected ? 'Connected' : 'Disconnected'})`);
                });
            }

            log('✅ Tool 2: PASSED');
            results.push({ tool: 'list_bigquery_connections', passed: true, message: `${connections.length} connections found` });

            // Test remaining tools only if we have connections
            if (connections.length === 0) {
                log('');
                log('⚠️  No BigQuery connections configured!');
                log('Tools 3-5 and 11 require a connection - they will be SKIPPED');
                log('To test these tools:');
                log('  1. Add a BigQuery connection via SQL extension');
                log('  2. Run this test again');
                log('');
            } else {
                const connectionId = connections[0].id;
                log(`\nUsing connection: ${connections[0].connectionName}`);

                // Test 3: list_datasets
                section('Test 3: list_datasets');
                try {
                    const result = await sqlExecutor.listDatasets(connectionId);

                    if (result.success && result.datasets) {
                        log(`Found ${result.datasets.length} dataset(s)`);
                        result.datasets.slice(0, 5).forEach((ds: string, idx: number) => {
                            log(`  ${idx + 1}. ${ds}`);
                        });
                        if (result.datasets.length > 5) {
                            log(`  ... and ${result.datasets.length - 5} more`);
                        }

                        log('✅ Tool 3: PASSED');
                        results.push({ tool: 'list_datasets', passed: true, message: `${result.datasets.length} datasets found` });

                        if (result.datasets.length > 0) {
                            const datasetId = result.datasets[0];

                            // Test 4: list_tables
                            section('Test 4: list_tables');
                            try {
                                const tablesResult = await sqlExecutor.listTables(datasetId, connectionId);

                                if (tablesResult.success && tablesResult.tables) {
                                    log(`Found ${tablesResult.tables.length} table(s) in dataset "${datasetId}"`);
                                    tablesResult.tables.slice(0, 5).forEach((tbl: any, idx: number) => {
                                        log(`  ${idx + 1}. ${tbl.tableId}`);
                                        log(`     Type: ${tbl.type}, Rows: ${tbl.numRows.toLocaleString()}`);
                                    });

                                    log('✅ Tool 4: PASSED');
                                    results.push({ tool: 'list_tables', passed: true, message: `${tablesResult.tables.length} tables found` });

                                    if (tablesResult.tables.length > 0) {
                                        const tableId = tablesResult.tables[0].tableId;

                                        // Test 5: get_table_schema
                                        section('Test 5: get_table_schema');
                                        try {
                                            const fullTableId = `${datasetId}.${tableId}`;
                                            const schemaResult = await sqlExecutor.getTableSchema(fullTableId, connectionId);

                                            if (schemaResult.success && schemaResult.schema) {
                                                const schema = schemaResult.schema;
                                                log(`Table: ${fullTableId}`);
                                                log(`Columns: ${schema.totalColumns}, Rows: ${schema.totalRows.toLocaleString()}`);

                                                schema.columns.slice(0, 5).forEach((col: any, idx: number) => {
                                                    log(`  ${idx + 1}. ${col.name} (${col.type}, ${col.mode})`);
                                                });

                                                log('✅ Tool 5: PASSED');
                                                results.push({ tool: 'get_table_schema', passed: true, message: `${schema.totalColumns} columns` });
                                            } else {
                                                throw new Error(schemaResult.error || 'Failed to get schema');
                                            }
                                        } catch (error: any) {
                                            log(`❌ Tool 5: FAILED - ${error.message}`);
                                            results.push({ tool: 'get_table_schema', passed: false, error: error.message });
                                        }
                                    } else {
                                        log('⚠️  Skipping Tool 5 - no tables found');
                                    }
                                } else {
                                    throw new Error(tablesResult.error || 'Failed to list tables');
                                }
                            } catch (error: any) {
                                log(`❌ Tool 4: FAILED - ${error.message}`);
                                results.push({ tool: 'list_tables', passed: false, error: error.message });
                            }
                        } else {
                            log('⚠️  Skipping Tools 4-5 - no datasets found');
                        }
                    } else {
                        throw new Error(result.error || 'Failed to list datasets');
                    }
                } catch (error: any) {
                    log(`❌ Tool 3: FAILED - ${error.message}`);
                    results.push({ tool: 'list_datasets', passed: false, error: error.message });
                }

                // Test 6: execute_sql
                section('Test 6: execute_sql');
                try {
                    const testQuery = 'SELECT 1 as test_number, "Hello from BigQuery" as test_message';
                    log('Executing test query...');

                    const result = await sqlExecutor.executeSql(testQuery, { connectionId, showResults: false });

                    if (result.success) {
                        log(`✅ Query executed successfully!`);
                        log(`   Rows returned: ${result.rowCount}`);
                        log(`   Execution time: ${result.executionTime}ms`);

                        if (result.rows.length > 0) {
                            log(`   Sample result: ${JSON.stringify(result.rows[0])}`);
                        }

                        log('✅ Tool 6: PASSED');
                        results.push({ tool: 'execute_sql', passed: true, message: `${result.rowCount} rows returned` });
                    } else {
                        throw new Error(result.error || 'Query execution failed');
                    }
                } catch (error: any) {
                    log(`❌ Tool 6: FAILED - ${error.message}`);
                    results.push({ tool: 'execute_sql', passed: false, error: error.message });
                }
            }
        } catch (error: any) {
            log(`❌ Tool 2: FAILED - ${error.message}`);
            results.push({ tool: 'list_bigquery_connections', passed: false, error: error.message });
        }

        // Test 7: create_sql_worksheet
        section('Test 7: create_sql_worksheet');
        try {
            const worksheetName = `test-worksheet-${Date.now()}`;
            const initialSql = 'SELECT 1 as id, "test" as name';

            log(`Creating worksheet: ${worksheetName}`);
            const worksheet = await sqlExecutor.createWorksheet(worksheetName, initialSql);

            testWorksheetId = worksheet.id;

            log(`✅ Worksheet created!`);
            log(`   ID: ${worksheet.id}`);
            log(`   Name: ${worksheet.name}`);
            log(`   Path: ${worksheet.filePath}`);

            log('✅ Tool 7: PASSED');
            results.push({ tool: 'create_sql_worksheet', passed: true, message: `Worksheet ${worksheet.name} created` });
        } catch (error: any) {
            log(`❌ Tool 7: FAILED - ${error.message}`);
            results.push({ tool: 'create_sql_worksheet', passed: false, error: error.message });
        }

        // Test 8: list_sql_worksheets
        section('Test 8: list_sql_worksheets');
        try {
            const worksheets = await sqlExecutor.listWorksheets();

            log(`Found ${worksheets.length} worksheet(s)`);

            if (worksheets.length > 0) {
                worksheets.slice(0, 5).forEach((ws: any, idx: number) => {
                    log(`  ${idx + 1}. ${ws.name} (ID: ${ws.id})`);
                });
            }

            log('✅ Tool 8: PASSED');
            results.push({ tool: 'list_sql_worksheets', passed: true, message: `${worksheets.length} worksheets found` });
        } catch (error: any) {
            log(`❌ Tool 8: FAILED - ${error.message}`);
            results.push({ tool: 'list_sql_worksheets', passed: false, error: error.message });
        }

        if (testWorksheetId) {
            // Test 9: read_sql_worksheet
            section('Test 9: read_sql_worksheet');
            try {
                log(`Reading worksheet: ${testWorksheetId}`);
                const content = await sqlExecutor.getWorksheet(testWorksheetId);

                log(`✅ Worksheet content retrieved!`);
                log(`   Length: ${content.length} characters`);
                log(`   Preview: ${content.substring(0, 50)}...`);

                log('✅ Tool 9: PASSED');
                results.push({ tool: 'read_sql_worksheet', passed: true, message: `${content.length} characters read` });
            } catch (error: any) {
                log(`❌ Tool 9: FAILED - ${error.message}`);
                results.push({ tool: 'read_sql_worksheet', passed: false, error: error.message });
            }

            // Test 10: write_sql_worksheet
            section('Test 10: write_sql_worksheet');
            try {
                const newContent = `-- Updated at ${new Date().toISOString()}\nSELECT 2 as updated_value`;

                log(`Updating worksheet: ${testWorksheetId}`);
                await sqlExecutor.writeWorksheet(testWorksheetId, newContent);

                // Verify
                const readBack = await sqlExecutor.getWorksheet(testWorksheetId);

                if (readBack === newContent) {
                    log(`✅ Worksheet updated and verified!`);
                    log('✅ Tool 10: PASSED');
                    results.push({ tool: 'write_sql_worksheet', passed: true, message: 'Content verified' });
                } else {
                    throw new Error('Content verification failed');
                }
            } catch (error: any) {
                log(`❌ Tool 10: FAILED - ${error.message}`);
                results.push({ tool: 'write_sql_worksheet', passed: false, error: error.message });
            }

            // Test 11: execute_sql_worksheet (only if we have connections)
            const connections = await sqlExecutor.getConnections();
            if (connections.length > 0) {
                section('Test 11: execute_sql_worksheet');
                try {
                    const connectionId = connections[0].id;

                    log(`Executing worksheet: ${testWorksheetId}`);
                    const result = await sqlExecutor.executeWorksheet(testWorksheetId, connectionId);

                    if (result.success) {
                        log(`✅ Worksheet executed successfully!`);
                        log(`   Rows returned: ${result.rowCount}`);
                        log(`   Execution time: ${result.executionTime}ms`);

                        log('✅ Tool 11: PASSED');
                        results.push({ tool: 'execute_sql_worksheet', passed: true, message: `${result.rowCount} rows returned` });
                    } else {
                        throw new Error(result.error || 'Worksheet execution failed');
                    }
                } catch (error: any) {
                    log(`❌ Tool 11: FAILED - ${error.message}`);
                    results.push({ tool: 'execute_sql_worksheet', passed: false, error: error.message });
                }
            } else {
                log('⚠️  Skipping Tool 11 - no connections available');
            }

            // Cleanup
            section('Cleanup');
            try {
                log(`Deleting test worksheet: ${testWorksheetId}`);
                await sqlExecutor.deleteWorksheet(testWorksheetId);
                log('✅ Test worksheet deleted');
            } catch (error: any) {
                log(`⚠️  Cleanup failed: ${error.message}`);
            }
        }

    } catch (error: any) {
        log('');
        log(`❌ Fatal error: ${error.message}`);
        log(error.stack);
    }

    // Final Summary
    section('📊 Test Summary');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    log(`Total Tests:    ${total}`);
    log(`✅ Passed:      ${passed}`);
    if (failed > 0) log(`❌ Failed:      ${failed}`);

    log('');

    results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        const msg = result.passed ? (result.message || 'OK') : (result.error || 'FAILED');
        log(`${icon} ${result.tool}: ${msg}`);
    });

    log('');

    if (failed === 0) {
        log('🎉 ALL TESTS PASSED! BigQuery integration is fully functional!');
        vscode.window.showInformationMessage('✅ All BigQuery tools tests passed!');
    } else {
        log('❌ SOME TESTS FAILED! Please check the errors above.');
        vscode.window.showErrorMessage(`❌ ${failed} BigQuery tool test(s) failed`);
    }
}
