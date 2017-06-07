$(document).ready(function () {

    var websocket_server = 'ws://' + window.location.hostname + ':9000';
    var socket = null;
    var finalName = '';

    $('#name').bind('input propertychange', function () {
        var hostname = $(this).val();

        $.ajax({
            type: 'GET',
            url: 'CheckHostName',
            data: {
                name: hostname
            }
        }).done(function (data) {
            if (data === 'ok') {
                $('#name').css('border-color', 'green');
                $('#SendToAnsibleApi').attr('disabled', false);
            }
            else {
                $('#name').css('border-color', 'red');
                $('#SendToAnsibleApi').attr('disabled', true);
            }
        }).fail(function (error) {
            console.log(JSON.stringify(error));
        });
    });

    $('#createMachine').submit(function (event) {
        event.preventDefault();
        $('#outputbody').toggle();
        finalName = $('#name').val();
        $('#result').text('');
        $(".progress-bar").animate(
            {
                width: '5%'
            }, 1000
        );
        $('.progress-bar').text('5%');
        $('#SendToAnsibleApi').attr('disabled', true);
        $('#expertbtn').removeAttr("data-toggle");
        $('#expertbtn').attr('disabled', true);
        $('#name').attr('disabled', true);
        $('#ProgressName').text($('#name').val());
        $('#progress').addClass("active");
        websocket();
    });

    function checkHost() {
        var host = {};
        $('input[name*="host"]').each(function () {
            host[this.id] = $(this).val();
        });
        return JSON.stringify(host);
    }

    function checkWebServer() {
        var array = {};
        if ($('#apacheCheckbox').is(':checked')) {
            array['webserver'] = 'apache';
            array['document_root'] = $('#apache_document_root').val();
            return JSON.stringify(array);
        } else if ($('#nginxCheckbox').is(':checked')) {
            array['webserver'] = 'nginx';
            array['document_root'] = $('#nginx_document_root').val();
            return JSON.stringify(array);
        } else {
            return null;
        }
    }

    function checkDatabase() {
        var array = {};
        if ($('#mysqlCheckbox').is(':checked')) {
            array['database'] = 'mysql';
            array['mysql_root_password'] = $('#mysql_root_password').val();
            array['mysql_new_user'] = $('#mysql_new_user').val();
            array['mysql_new_user_password'] = $('#mysql_new_user_password').val();
            array['mysql_database'] = $('#mysql_database').val();
            return JSON.stringify(array);
        } else if ($('#mongodbCheckbox').is(':checked')) {
            array['database'] = 'mongodb';
            array['mongodb_new_user'] = $('#mongodb_new_user').val();
            array['mongodb_new_user_password'] = $('#mongodb_new_user_password').val();
            array['mongodb_database'] = $('#mongodb_database').val();
            return JSON.stringify(array);
        } else {
            return null;
        }
    }

    function checkPackages() {
        let packages = $('[name="packages[]"]').val();
        if (packages) {
            return JSON.stringify(packages);
        } else {
            return null;
        }
    }

    function checkDns() {
        var array = {};
        if ($('#dnsCheckbox').is(':checked')) {
            array['dns_domain_name'] = $('#dns_domain_name').val();
            array['dns_type'] = $('#dns_type').val();
            return JSON.stringify(array);
        } else {
            return null;
        }
    }

    function websocket() {
        try {
            socket = new WebSocket(websocket_server);
            socket.onerror = function () {
                console.log('connection error');
            };
            socket.onopen = function () {
                console.log('connection open');
                $.ajax({
                    type: 'GET',
                    url: 'PlayBook',
                    data: {
                        playbook: 'installmachine',
                        host: checkHost(),
                        packages: checkPackages(),
                        webserver: checkWebServer(),
                        database: checkDatabase(),
                        dns: checkDns()
                    }
                }).done(function () {
                    $.ajax({
                        type: 'GET',
                        url: 'GetNewMachineData',
                        data: {
                            name: finalName
                        }
                    }).done(function (data) {
                        var machine = JSON.parse(data);
                        $('#ipaddress').text(machine.ip);
                        $('#status').text(machine.status);
                    }).fail(function (error) {
                        console.log(JSON.stringify(error));
                    });
                }).fail(function (error) {
                    console.log(JSON.stringify(error));
                });

            };

            socket.onmessage = function (msg) {
                var data = JSON.parse(msg.data);
                if ("task" in data) {

                    $('#task').text(data.task);

                    if ((data.progress == "0") && (data.task != "Install Machine Notification")) {
                        $('#result').append('Start : ' + data.task + '<br>');
                    }
                    if ((data.progress == "100") && (data.task != "Install Machine Notification")) {
                        $('#result').append('Stop : ' + data.task + '<br>');
                    }
                    if ((data.progress == "100") && (data.task == "Install Machine Notification")) {

                        $('#name').val('');
                        $('#name').css('border-color', '');
                        $('#progress').removeClass("active");
                        $('#SendToAnsibleApi').removeAttr("disabled");
                        $('#expertbtn').removeAttr("disabled");
                        $('#expertbtn').attr('data-toggle', 'collapse');
                        $('#name').removeAttr("disabled");
                        $('#task').text('Installation Completed');
                        $('#result').append('Installation Completed<br>');
                        socket.close();
                    }

                }

                if ("progress" in data) {
                    $(".progress-bar").animate(
                        {
                            width: data.progress + '%'
                        }, 1000
                    );
                    $('.progress-bar').text(data.progress + '%');
                }
            };

            socket.onclose = function () {
                console.log('connection closed');
                $('#name').val('');
                $('#progress').removeClass("active");
                $('#SendToAnsibleApi').removeAttr("disabled");
                $('#expertbtn').removeAttr("disabled");
                $('#name').removeAttr("disabled");
                $.ajax({
                    type: 'GET',
                    url: 'GetNewMachineData',
                    data: {
                        name: finalName
                    }
                }).done(function (data) {
                    var machine = JSON.parse(data);
                    $('#ipaddress').text(machine.ip);
                    $('#status').text(machine.status);
                }).fail(function (error) {
                    console.log(JSON.stringify(error));
                });
            };
        }
        catch (e) {
            console.log(e);
        }
    }
});
