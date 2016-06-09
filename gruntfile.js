module.exports = function( grunt ) {
    'use strict';
    // Project Configuration

    function enquote( str ) {
        return '"' + str + '"';
    }

    grunt.initConfig( {
        pkg: grunt.file.readJSON( 'package.json' ),
        eslint: {
            options: {
                configFile: '.eslintrc',
                fix: true
            },
            target: [ 'gruntfile.js', 'www/calendarDemoCtrl.js', 'src/**/*.js' ]
        },
        html2js: {
            dist_tpls: {
                options: {
                    module: null, // no bundle module for all the html2js templates
                    base: '.'
                },
                files: [
                    {
                        expand: true,
                        src: [ 'templates/**/*.html' ],
                        dest: 'build',
                        ext: '.html.js'
                    }
                ]
            }
        },
        'string-replace': {
            dist_tpls: {
                files: {
                    'build/': 'src/calendar.js'
                },
                options: {
                    replacements: [
                        {
                            pattern: 'angular.module( \'ui.rCalendar\', [] )',
                            replacement: 'angular.module( \'ui.rCalendar\', [ \'ui.rCalendar.tpls\' ] )'
                        }
                    ]
                }
            }
        },
        copy: {
            css: {
                files: [
                    {
                        expand: true,
                        src: [ '*.css' ],
                        cwd: 'src/',
                        dest: 'www/dist/css'
                    }
                ]
            }
        },
        concat: {
            dist_tpls: {
                options: {
                    banner: 'angular.module( "ui.rCalendar.tpls", [ ' + grunt.file.expand( 'templates/**/*.html' ).map( enquote ) + ' ] );\n'
                },
                src: [
                    'build/src/**/calendar.js', 'build/templates/**/*.html.js'
                ],
                dest: 'www/dist/js/calendar-tpls.js'
            }
        },
        uglify: {
            dist_tpls: {
                options: {
                    mangle: false
                },
                src: [ 'www/dist/js/calendar-tpls.js' ],
                dest: 'www/dist/js/calendar-tpls.min.js'
            },
            dist: {
                src: [ 'src/calendar.js' ],
                dest: 'www/dist/js/calendar.min.js'
            }
        },
        cssmin: {
            dist: {
                files: [
                    {
                        'www/dist/css/calendar.min.css': [ 'css/**/*.css' ]
                    }
                ]
            }
        },
        clean: [ 'build' ]
    } );

    //Load NPM tasks
    grunt.loadNpmTasks( 'grunt-contrib-concat' );
    grunt.loadNpmTasks( 'grunt-contrib-copy' );
    grunt.loadNpmTasks( 'grunt-eslint' );
    grunt.loadNpmTasks( 'grunt-contrib-uglify' );
    grunt.loadNpmTasks( 'grunt-contrib-cssmin' );
    grunt.loadNpmTasks( 'grunt-contrib-clean' );
    grunt.loadNpmTasks( 'grunt-string-replace' );
    grunt.loadNpmTasks( 'grunt-html2js' );

    //Making grunt default to force in order not to break the project.
    grunt.option( 'force', true );

    //Build task.
    grunt.registerTask( 'build', [ 'eslint', 'copy:css', 'uglify:dist', 'cssmin:dist' ] );
    //Build task.
    grunt.registerTask( 'build-tpls', [
        'eslint',
        'copy:css',
        'html2js:dist_tpls',
        'string-replace:dist_tpls',
        'concat:dist_tpls',
        'uglify:dist_tpls',
        'cssmin:dist',
        'clean'
    ] );
};
