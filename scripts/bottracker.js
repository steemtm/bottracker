$(function () {
    var RETURN = 1.25;
    var AUTHOR_REWARDS = 0.75;
    var bots = [
      { name: 'booster', interval: 1.2 },
      { name: 'bellyrub', interval: 2.4 },
      { name: 'buildawhale', interval: 2.4 },
      { name: 'boomerang', interval: 2.4 },
      { name: 'minnowhelper', interval: 2.4 }
      /*{ name: 'khoa', interval: 2.4 },
      { name: 'polsza', interval: 2.4 },
      { name: 'discordia', interval: 2.4 },
      { name: 'lovejuice', interval: 2.4 },
      { name: 'drotto', interval: 2.4 },*/
    ];
    var bot_names = [];
    bots.forEach(function(bot) { bot_names.push(bot.name); });

    function loadAccountInfo() {
      steem.api.getAccounts(['randowhale'], function (err, result) {
        var account = result[0];
        var bar = $('#randowhale-progress div');
        var power = getVotingPower(account) / 100;
        bar.attr('aria-valuenow', power);
        bar.css('width', power + '%');
        bar.text(power + '%');

        var time = timeTilFullPower(account) * 1000;
        $('#randowhale-time').attr('time', time);
        $('#randowhale-time').text(toTimer(time));
        $('#randowhale-vote').text('$' + getVoteValue(1.6, account).formatMoney());

        var metadata = JSON.parse(account.json_metadata);
        var status = $('#randowhale-status');
        status.removeClass('label-default');
        status.removeClass('label-success');

        if(metadata.config.sleep) {
          status.text('Sleeping');
          status.addClass('label-default');
        } else {
          status.text('Awake!');
          status.addClass('label-success');
        }

        var panel = $('#randowhale-panel');
        panel.removeClass('panel-default');
        panel.removeClass('panel-success');
        panel.addClass('panel-' + (metadata.config.sleep ? 'default' : 'success'));
      });

      steem.api.getAccounts(['minnowbooster'], function (err, result) {
        var account = result[0];
        var bar = $('#minnowbooster-progress div');
        var power = getVotingPower(account) / 100;
        bar.attr('aria-valuenow', power);
        bar.css('width', power + '%');
        bar.text(power + '%');
        var vote = getVoteValue(100, account);
        var weight = 3 / vote;
        console.log('vote: ' + vote + ', weight: ' + weight + ', power: ' + power + ', value: ' + getVoteValue(weight, account));
        $('#minnowbooster-weight').text((weight * 100).formatMoney(1) + '%');
        $('#minnowbooster-vote').text('$' + getVoteValue(weight, account).formatMoney());
      });
    }

    function loadBotInfo() {
        steem.api.getAccounts(bot_names, function (err, result) {
            //for(var i = 0; i < result.length; i++) {
            //    var account = result[i];
            result.forEach(function (account) {
                var vote = getVoteValue(100, account);
                var last_vote_time = new Date((account.last_vote_time) + 'Z');

                steem.api.getAccountHistory(account.name, -1, (account.name == 'booster') ? 1000 : 200, function (err, result) {
                    var total = 0, last_date = 0;
                    result.forEach(function(trans) {
                      var op = trans[1].op;
                      var ts = new Date((trans[1].timestamp) + 'Z');

                      if(op[0] == 'transfer' && op[1].to == account.name && ts > last_vote_time)
                        total += parseFloat(op[1].amount.replace(" SBD", ""));
                    });

                    var bot = bots.filter(function(b) { return b.name == account.name; })[0];
                    bot.vote = vote * bot.interval / 2.4;
                    bot.total = total;
                    bot.bid = (AUTHOR_REWARDS * bot.vote - RETURN * total) / RETURN;
                    bot.power = getVotingPower(account) / 100;
                    bot.last = (new Date() - last_vote_time);
                    bot.next = timeTilFullPower(account) * 1000;
                });
            });

            setTimeout(showBotInfo, 5 * 1000);
            setTimeout(loadBotInfo, 30 * 1000);
        });
    }

    function showBotInfo() {
      if(bots.length == 0 || !bots[0].vote)
        return;

      bots.forEach(function(bot) {
        bot.last += 1000;
        bot.next = Math.max(bot.next - 1000, 0);
      });

      $('#bots_table tbody').empty();

      bots.sort(function(a, b) {
        var an = (a.power == 100 && a.last > 5 * HOURS) ? 999 : a.next;
        var bn = (b.power == 100 && b.last > 5 * HOURS) ? 999 : b.next;
        return an - bn;
      });

      bots.forEach(function(bot) {
        var row = $(document.createElement('tr'));

        var td = $(document.createElement('td'));
        var link = $(document.createElement('a'));
        link.attr('href', 'http://www.steemit.com/@' + bot.name);

        if(bot.power == 100 && bot.last > 5 * HOURS || bot.power < 90)
          link.text('@' + bot.name + ' (DOWN)');
        else
          link.text('@' + bot.name);

        td.append(link);
        row.append(td);

        td = $(document.createElement('td'));
        td.text('$' + bot.vote.formatMoney() + ' (' + (bot.interval / 2.4 * 100) + '%)');
        row.append(td);

        td = $(document.createElement('td'));
        td.text('$' + bot.total.formatMoney());
        row.append(td);

        td = $(document.createElement('td'));
        td.text('$' + Math.max(bot.bid, 0).formatMoney());
        row.append(td);

        td = $(document.createElement('td'));
        var bar = $('#randowhale-progress div').clone();
        var pct = (bot.power - 90) * 10;
        bar.attr('aria-valuenow', pct);
        bar.css('width', pct + '%');
        bar.text(bot.power.formatMoney());

        var div = $(document.createElement('div'));
        div.addClass('progress');
        div.append(bar);
        td.append(div);
        row.append(td);

        td = $(document.createElement('td'));
        td.addClass('timer');
        td.attr('dir', 'up');
        td.attr('time', bot.last);
        td.text(toTimer(bot.last));
        row.append(td);

        td = $(document.createElement('td'));
        td.addClass('timer');
        td.attr('time', bot.next);
        td.text(toTimer(bot.next));
        row.append(td);

        if (bot.bid > 0 && bot.next < 0.16 * HOURS && bot.last > 0.5 * HOURS)
          row.css('background-color', '#aaffaa');

        if(bot.power == 100 && bot.last > 5 * HOURS || bot.power < 90)
          row.css('background-color', '#ffaaaa');

        $('#bots_table tbody').append(row);
      });
    }

    setTimeout(loadBotInfo, 5 * 1000);
    setTimeout(loadAccountInfo, 5 * 1000);
    setInterval(updateTimers, 1000);
});
