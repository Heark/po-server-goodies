/*jslint continue: true, es5: true, evil: true, forin: true, plusplus: true, sloppy: true, vars: true, regexp: true, newcap: true*/
/*global sys, SESSION, script, print, gc, version, Config, require, module, exports*/

Object.isObject = function (obj) {
    return typeof obj === "object" && obj !== null && !Array.isArray(obj);
};

Object.isPopulatedObject = function (obj) {
    return Object.isObject(obj) && Object.keys(obj) > 0;
};

Object.has = function (obj, prop) {
    if (!Object.isObject(obj)) {
        return false;
    }

    return Object.prototype.hasOwnProperty.call(obj, prop);
};

Object.extend = function (tr, tr2) {
    var i;
    
    for (i in tr2) {
        tr[i] = tr2[i];
    }
    
    return tr;
};

String.escapeHtml = function (str) {
    return String(str).replace(/\&/g, "&amp;").replace(/</g, "&lt;").replace(/\>/g, "&gt;");
};

if (typeof updateArena !== "undefined" || typeof arena === "undefined") {
    if (typeof updateArena !== "undefined") {
        delete updateArena;
    }

    arena = (function BattleArena() {
        var name = "Battle Arena",
            bot = {
                "name": "±Battle Arena",
                "color": "darkorange"
            },
            util = {
                player: {
                    hasPermission: function (src, minAuth) {
                        return sys.auth(src) >= minAuth;
                    },
                    player: function (user) {
                        return "<b><font color='" + util.player.color(user) + "'>" + String.escapeHtml(util.player.name(user)) + "</font></b>";
                    },
                    name: function (user) {
                        if (typeof user === "string") {
                            return sys.name(sys.id(user));
                        } else if (user !== undefined) {
                            return sys.name(user);
                        }
                            
                        return user;
                    },
                    id: function (user) {
                        if (typeof user === "string") {
                            return sys.id(user);
                        } else if (user !== undefined) {
                            return user;
                        }
                        
                        return user;
                    },
                    color: function (user) {
                        var src = util.player.id(user),
                            myColor = sys.getColor(src),
                            colorlist;

                        if (myColor === '#000000') {
                            colorlist = [
                                '#5811b1', '#399bcd', '#0474bb', '#f8760d', '#a00c9e', '#0d762b', '#5f4c00', '#9a4f6d',
                                '#d0990f',
                                '#1b1390', '#028678', '#0324b1'
                            ];
                            return colorlist[src % colorlist.length];
                        }

                        return myColor;
                    }
                },
                bot: {
                    send: function (src, message, channel) {
                        var color = bot.color,
                            name = bot.name;

                        if (typeof channel !== "undefined") {
                            sys.sendHtmlMessage(src, "<font color='" + color + "'><timestamp/><b>" + name + ":</i></b></font> " + message, channel);
                        } else {
                            sys.sendHtmlMessage(src, "<font color='" + color + "'><timestamp/><b>" + name + ":</i></b></font> " + message);
                        }

                        return this;
                    },
                    sendText: function (src, message, channel) {
                        util.bot.send(src, String.escapeHtml(message), channel);

                        return this;
                    },
                    sendAll: function (message, channel) {
                        var color = bot.color,
                            name = bot.name;

                        if (typeof channel !== "undefined") {
                            sys.sendHtmlAll("<font color='" + color + "'><timestamp/><b>" + name + ":</i></b></font> " + message, channel);
                        } else {
                            sys.sendHtmlAll("<font color='" + color + "'><timestamp/><b>" + name + ":</i></b></font> " + message);
                        }

                        return this;
                    },
                    sendAllText: function (message, channel) {
                        return util.bot.sendAllText(String.escapeHtml(message), channel);
                    }
                },
                json: {
                    read: function (file) {
                        var code;

                        sys.appendToFile(file, "");
                        code = sys.getFileContent(file);
                        
                        if (code === "") {
                            code = "{}";
                        }
                        
                        return JSON.parse(code) || {};
                    },
                    write: function (file, code) {
                        sys.writeToFile(file, JSON.stringify(code));
                        return this;
                    }
                }
            },
            dataFile = "BattleArenaPlayers.json",
            players = util.json.read(dataFile),
            downloadJSON = function (url) {
                var res = sys.synchronousWebCall(url);

                if (res === "") {
                    print("Couldn't load data from " + url + ".");
                    return "{}";
                }

                return res;
            },
            mobPokemons,
            playerPokemons;

        mobPokemons = JSON.parse(
            sys.getFileContent('data/mobpokemons.json')
        );

        playerPokemons = JSON.parse(
            sys.getFileContent('data/playerpokemons.json')
        );

        function mobIndex(mobName) {
            var ret = -1;

            mobName = mobName.toLowerCase();

            arena.mobs.forEach(function (value, index, array) {
                if (ret !== -1) {
                    return;
                }

                if (value.name.toLowerCase() === mobName) {
                    ret = index;
                }
            });

            return ret;
        }

        function testDead(hash) {
            if (!hash) {
                print("Unknown hash in testDead()");
                return;
            }
            
            if (hash.dead) {
                if (hash.time <= +(sys.time())) {
                    delete hash.dead;
                }
            }
            
            return hash;
        }
        
        /* arena.battle(battleInfo): 
         {
         attacker: (String) attackerName
         target: (String) targetName
         byMob: (Boolean) attackerIsMob
         toMob: (Boolean) attackedPokemonIsMob
         }
         */
        function battle(battleInfo) {
            var target = battleInfo.target,
                targetLC = target.toLowerCase(),
                targetHash = arena.players[targetLC],
                formatted = util.player.player(target),
                attacker = battleInfo.attacker,
                attackerLC = attacker.toLowerCase(),
                attackerFormatted = util.player.player(attacker),
                selfHash = arena.players[attackerLC],
                arenaMobIndex = arena.mobIndex(target),
                hash,
                cooldown,
                byMob = battleInfo.byMob,
                toMob = battleInfo.toMob,
                mobName = "",
                attackMsg,
                dataHealth,
                healthBack;

            if (toMob) {
                targetHash = arena.mobs[arenaMobIndex];
                formatted = target.bold();
                mobName = targetHash.name.toLowerCase();
            } else if (targetHash.health <= 0) {
                targetHash.health = arena.playerPokemons[targetHash.num].health;
            }
            
            if (byMob) {
                selfHash = arena.mobs[arena.mobIndex(attacker)];
                attackerFormatted = attacker.bold();
            }
            
            targetHash.health -= selfHash.damage;

            if (targetHash.health < 0) {
                targetHash.health = 0;
            }

            if (byMob) {
                attackMsg = attackerFormatted + " (" + arena.mobGroups[selfHash.group].name + ") decided to attack " + formatted + " (" + targetHash.name + ")!";
            } else if (toMob) {
                attackMsg = attackerFormatted + " (" + selfHash.name + ") and " + formatted + " (" + arena.mobGroups[targetHash.group].name + ") are battling!";
            } else {
                attackMsg = attackerFormatted + " (" + selfHash.name + ") and " + formatted + " (" + targetHash.name + ") are battling!";
            }

            arena.sendAll(attackMsg + "  " + attackerFormatted + " " + selfHash.attack.toLowerCase() + "s " + formatted + ", " + selfHash.msg + "! " + formatted + " lost " + selfHash.damage + " HP (" + targetHash.health + " HP left)!", arena.chan);

            if (targetHash.health > 0) {
                if (toMob && arenaMobIndex !== -1) {
                    arena.mobs[arenaMobIndex] = targetHash;
                } else {
                    arena.players[target.toLowerCase()] = targetHash;
                }
                return;
            }

            // Mob: Kill = switch target
            if (byMob) {
                selfHash.memory.targetAttacks = selfHash.maxAttacksOnTarget;
            } else {
                if (!selfHash.kills) {
                    selfHash.kills = 0;
                }
                selfHash.kills++;
            }

            if (!toMob) {
                hash = Object.extend({}, arena.playerPokemons[targetHash.num - 1]);
                if (Object.isPopulatedObject(hash)) {
                    targetHash = hash;
                } else {
                    targetHash = Object.extend({}, arena.playerPokemons[0]);
                }

                cooldown = byMob ? arena.MOB_KILL_COOLDOWN : arena.PLAYER_KILL_COOLDOWN;
                targetHash.time = +(sys.time()) + cooldown;
                targetHash.dead = true;
            }

            if (!byMob) {
                dataHealth = Math.round(arena.playerPokemons[selfHash.num].health * arena.HEALTH_MAX);
                healthBack = Math.round(selfHash.damage * arena.HEALTH_RESTORED);

                selfHash.health += healthBack;

                if (selfHash.health > dataHealth) {
                    selfHash.health = dataHealth;
                }
            }
            
            if (toMob && arenaMobIndex !== -1) {
                arena.mobs[arenaMobIndex] = targetHash;
            } else {
                arena.players[targetLC] = targetHash;
            }

            if (byMob) {
                arena.sendAll(formatted + " became a " + targetHash.name + " and has to wait " + cooldown + " seconds to continue playing!", arena.chan);
                return;
            } else if (toMob) {
                arena.slayMob(mobName);
                arena.sendAll(formatted + " despawned! " + attackerFormatted + " now has " + selfHash.kills + " constructive kill(s), and got " + healthBack + " HP back (currently " + selfHash.health + " HP)!", arena.chan);
            } else {
                arena.sendAll(formatted + " became a " + targetHash.name + " and has to wait " + cooldown + " seconds to continue playing! " + attackerFormatted + " now has " + selfHash.kills + " constructive kill(s), and got " + healthBack + " HP back (currently " + selfHash.health + " HP)!", arena.chan);
            }

            if (selfHash.kills >= selfHash.killsRequired && Object.isPopulatedObject(arena.playerPokemons[selfHash.num + 1])) {
                selfHash = arena.playerPokemons[selfHash.num + 1];
                selfHash.kills = 0;

                arena.sendAll(attackerFormatted + " became a(n) " + selfHash.name + "!", arena.chan);
            }

            arena.players[attackerLC] = selfHash;
        }

        function tryAttackMob(src, self, selfName, selfHash, dcmd) {
            var timeNow = +(sys.time()),
                mobindex = mobIndex(dcmd);

            /* No such mob */
            if (mobindex === -1) {
                return true;
            }

            if (selfHash.time !== undefined) {
                if (selfHash.time > timeNow) {
                    arena.send(src, "You can't attack for another " + (selfHash.time - timeNow) + " second(s).", arena.chan);
                    return;
                } else {
                    selfHash.time = timeNow + selfHash.cooldown;
                }
            } else {
                selfHash.time = timeNow + selfHash.cooldown;
            }

            //delete selfHash.dead;

            battle({
                attacker: selfName,
                target: arena.mobs[mobindex].name,
                byMob: false,
                toMob: true
            });
        }
        
        function slayPlayer(by, to) {
            var name = to.toLowerCase(),
                nameReadable = util.player.player(to),
                hash;
            
            if (!arena.players[name]) {
                arena.send(by, "That player doesn't exist!", arena.chan);
                return;
            }
            
            hash = Object.extend({}, arena.playerPokemons[arena.players[name].num - 1]);
            if (Object.isPopulatedObject(hash)) {
                arena.players[name] = hash;
            } else {
                arena.players[name] = Object.extend({}, arena.playerPokemons[0]);
            }

            arena.players[name].time = +(sys.time()) + arena.PLAYER_KILL_COOLDOWN;
            arena.players[name].dead = true;
            
            arena.sendAll(util.player.player(by) + " slayed " + nameReadable + "! " + nameReadable + " became a(n) " + arena.players[name].name + " and has to wait " + arena.PLAYER_KILL_COOLDOWN + " second(s) to respawn!", arena.chan);
            return true;
        }
        
        function spawnMob(name, silent) {
            var nameToLower = name.toLowerCase(),
                found = false,
                len = arena.mobPokemons.length,
                i;
            
            for (i = 0; i < len; i += 1) {
                if (arena.mobPokemons[i].name.toLowerCase() === nameToLower) {
                    found = arena.mobPokemons[i];
                    break;
                }
            }
            
            if (found === false) {
                return "Mob doesn't exist.";
            }
            
            if (arena.mobIndex(found.name) !== -1) {
                return "Mob has already spawned.";
            }
            
            arena.mobs.push(Object.extend(found, {
                "memory": {
                    "target": "",
                    "targetAttacks": 0
                }
            }));

            if (!silent) {
                arena.sendAll("A wild " + found.name + " (" + arena.mobGroups[found.group].name.toLowerCase() + ") appeared!", arena.chan);
            }

            if (found.despawns === false) {
                return true;
            }
            
            arena.timers.mobs[found.name.toLowerCase()] = sys.setTimer(function () {
                var index = arena.mobIndex(found.name);
                
                if (index === -1) {
                    return;
                }
                
                arena.sendAll(found.name + " despawned!", arena.chan);
                arena.mobs.splice(index, 1);
            }, found.despawnTime * 1000, false);
            
            return true;
        }
        
        function slayAllMobs() {
            var names = [],
                i;
            
            arena.mobs.forEach(function (mob) {
                names.push(mob.name);
            });
            
            for (i in arena.timers.mobs) {
                sys.unsetTimer(arena.timers.mobs[i]);
            }
            
            arena.mobs = [];
            arena.timers.mobs = [];
            
            return names;
        }
        
        function slayMob(name) {
            var index = arena.mobIndex(name);
                        
            if (index === -1) {
                return "Mob isn't alive.";
            }
                  
            arena.mobs.splice(index, 1);
            
            if (arena.timers.mobs[name.toLowerCase()]) {
                sys.unsetTimer(arena.timers.mobs[name.toLowerCase()]);
                delete arena.timers.mobs[name.toLowerCase()];
            }
            
            return true;
        }
        
        function levelUpPlayer(name) {
            var hash = arena.players[name.toLowerCase()];
            
            if (!hash) {
                return "Player doesn't exist.";
            }
            
            if (!arena.playerPokemons[hash.num + 1]) {
                return "Can't level up any further.";
            }
            
            arena.players[name.toLowerCase()] = Object.extend({}, arena.playerPokemons[hash.num + 1]);
            return true;
        }

        return {
            chan: -1,
            channelName: name,
            dataFile: dataFile,
            players: players,

            HEALTH_RESTORED: 1.3,
            HEALTH_MAX: 1.2,
            PLAYER_KILL_COOLDOWN: 10,
            MOB_KILL_COOLDOWN: 7,

            mobGroups: mobPokemons.groups,
            mobPokemons: mobPokemons.mobs,
            playerPokemons: playerPokemons,

            util: util,
            send: util.bot.send,
            sendAll: util.bot.sendAll,

            timers: {
                saveTimer: 0,
                mobTimer: 0,
                mobs: {}
            },
            sandbox: {},

            mobs: [], // mobs that are alive
            
            mobIndex: mobIndex,
            
            slayPlayer: slayPlayer,
            spawnMob: spawnMob,
            slayAllMobs: slayAllMobs,
            slayMob: slayMob,
            levelUpPlayer: levelUpPlayer,
            
            testDead: testDead,
            battle: battle,

            init: function () {
                if (sys.existChannel(name)) {
                    arena.chan = sys.channelId(name);
                } else {
                    arena.chan = sys.createChannel(name);
                }
            },

            // command: src, dcmd, mcmd
            commands: {
                commands: function (src) {
                    sys.sendHtmlMessage(src, "<h2>Battle Arena Commands</h2>", arena.chan);
                    sys.sendMessage(src, "", arena.chan);

                    sys.sendHtmlMessage(src, "<timestamp/> <b>attack</b> <i>[name]</i>: To attack [name]!", arena.chan);
                    sys.sendHtmlMessage(src, "<timestamp/> <b>tips</b>: Displays some tips that might help you become better.", arena.chan);

                    if (util.player.hasPermission(src, 1)) {
                        sys.sendHtmlMessage(src, "<h3>Moderator Commands</h3>", arena.chan);
                        sys.sendHtmlMessage(src, "<timestamp/> <b>levelplayer</b> <i>[name]</i>: Increases the level of [name] (changes their pokémon to the next tier).", arena.chan);
                        sys.sendHtmlMessage(src, "<timestamp/> <b>spawn</b> <i>[mob]</i>: Spawns a [mob]. Note that there may only be one of a specific mob.", arena.chan);
                        sys.sendHtmlMessage(src, "<timestamp/> <b>slay</b> <i>[name]</i>: Slays [name]. Respawn is not instant.", arena.chan);
                        sys.sendHtmlMessage(src, "<timestamp/> <b>slaymob</b> <i>[mob]</i>: Slays [mob].", arena.chan);
                        sys.sendHtmlMessage(src, "<timestamp/> <b>slaymobs</b>: Slays all mobs.", arena.chan);
                    }
                    
                    if (util.player.hasPermission(src, 2)) {
                        sys.sendHtmlMessage(src, "<h3>Administrator Commands</h3>", arena.chan);
                        sys.sendHtmlMessage(src, "<timestamp/> <b>update</b>: Updates Battle Arena.", arena.chan);
                    }
                    
                    if (sys.ip(src) === '127.0.0.1') {
                        sys.sendHtmlMessage(src, "<h3>Host Commands</h3>", arena.chan);
                        sys.sendHtmlMessage(src, "<timestamp/> <b>eval</b> <i>[expression]</i>: Evaluates the expression and returns the result.", arena.chan);
                    }

                    sys.sendMessage(src, "", arena.chan);
                },
                tips: function (src) {
                    arena.send(src, "Battle Arena Tips:", arena.chan);
                    sys.sendMessage(src, "", arena.chan);

                    arena.send(src,
                        "[*] It's always recommended to leave the channel if you aren't active, even for a brief moment. Mobs and players can still attack you if you are in the channel.",
                        arena.chan);
                    arena.send(src,
                        "[*] The more players there are in the channel, the more mobs will spawn.",
                        arena.chan);
                },
                attack: function (src, dcmd) {
                    var targetId = util.player.id(dcmd),
                        self = util.player.name(src),
                        selfName = sys.name(src).toLowerCase(),
                        selfHash = arena.players[selfName],
                        timeNow = +(sys.time()),
                        target,
                        targetFormatted,
                        targetHash;

                    if (targetId === undefined) {
                        if (tryAttackMob(src, self, selfName, selfHash, dcmd)) {
                            arena.send(src, dcmd + " doesn't exist!", arena.chan);
                        }
                        return;
                    }
                    if (src === targetId) {
                        arena.send(src, "You can't attack yourself!", arena.chan);
                        return;
                    }

                    target = util.player.name(targetId);
                    targetFormatted = util.player.player(target);
                    targetHash = arena.players[target.toLowerCase()];

                    if (!sys.isInChannel(targetId, arena.chan)) {
                        arena.send(src, targetFormatted + " isn't here! You can't attack them.");
                        return;
                    }

                    targetHash = arena.testDead(targetHash);
                    
                    if (targetHash.dead) {
                        arena.send(src, "You can't attack " + targetFormatted + " because he/she is dead!", arena.chan);
                        return;
                    }

                    if (selfHash.time !== undefined && selfHash.time > timeNow) {
                        arena.send(src, "You can't attack for " + (selfHash.time - timeNow) + " second(s).", arena.chan);
                        return;
                    }

                    selfHash.time = timeNow + selfHash.cooldown;

                    // delete selfHash.dead;

                    battle({
                        attacker: self,
                        target: target,
                        byMob: false,
                        toMob: false
                    });
                },
                // Mod commands
                levelplayer: function (src, dcmd) {
                    if (!util.player.hasPermission(src, 1)) {
                        return;
                    }
                    
                    var res = arena.levelUpPlayer(dcmd);
                    
                    if (typeof res === "string") {
                        arena.send(src, "Couldn't level up '" + dcmd + "': " + res, arena.chan);
                        return;
                    }
                    
                    arena.sendAll(util.player.player(src) + " made " + util.player.player(dcmd) + " a(n) " + arena.players[dcmd.toLowerCase()].name + "!", arena.chan);
                },
                slay: function (src, dcmd) {
                    if (!util.player.hasPermission(src, 1)) {
                        return;
                    }
                    
                    arena.slayPlayer(src, dcmd);
                },
                slaymob: function (src, dcmd) {
                    if (!util.player.hasPermission(src, 1)) {
                        return;
                    }
                    
                    var res = arena.slayMob(dcmd);
                    
                    if (typeof res === "string") {
                        arena.send(src, "Couldn't slay mob '" + dcmd + "': " + res, arena.chan);
                        return;
                    }
                    
                    arena.sendAll(util.player.player(src) + " slayed " + dcmd + "!", arena.chan);
                },
                slaymobs: function (src) {
                    if (!util.player.hasPermission(src, 1)) {
                        return;
                    }
                    
                    var names = slayAllMobs().join(", ");
                    
                    if (names === "") {
                        arena.send(src, "No mobs to slay.", arena.chan);
                        return;
                    }
                    
                    arena.sendAll(util.player.player(src) + " slayed " + names + "!", arena.chan);
                },
                spawn: function (src, dcmd) {
                    if (!util.player.hasPermission(src, 1)) {
                        return;
                    }
                    
                    var res = spawnMob(dcmd);
                    
                    if (typeof res === "string" || !res) {
                        arena.send(src, "Couldn't spawn mob '" + dcmd + "': " + res, arena.chan);
                        return;
                    }
                    
                    arena.send(src, "Spawned a(n) <b>" + dcmd + "</b>.", arena.chan);
                },
                // Admin commands
                update: function (src) {
                    if (!util.player.hasPermission(src, 2)) {
                        return;
                    }

                    updateArena = true;

                    arena.util.json.write(arena.dataFile, arena.players);

                    eval(sys.getFileContent("scripts.js"));
                    arena.init();

                    arena.sendAll("Battle Arena was updated!", arena.chan);
                },
                // Host commands
                eval: function (src, dcmd) {
                    if (sys.ip(src) !== '127.0.0.1') {
                        return;
                    }
                    sys.sendMessage(src, "Result: " + eval(dcmd));
                }
            }
        };
    }());
}

({
    serverStartUp: function () {
        arena.init();
    },
    beforeNewMessage: function (message) {
        if (message === "Script Check: OK") {
            arena.init();
            return;
        }
    },
    step: function () {
        var stop = false,
            players;

        if (typeof arena === "undefined") {
            return;
        }
        
        if ((++arena.timers.saveTimer) % 60 === 0) { /* Every minute so that the CPU doesn't explode */
            arena.util.json.write(arena.dataFile, arena.players);
        }

        if ((players = sys.playersOfChannel(arena.chan)).length < 3) {
            // Even if there are less than 3 people, control the mobs spawned previously or by spawn.
            players = players.filter(function (value, index, array) {
                return !arena.testDead(arena.players[sys.name(value).toLowerCase()] || {dead: false}).dead;
            }); // filter out any dead players
    
            if (players.length === 0) {
                return; // Can't attack dead players!
            }
    
            arena.mobs.forEach(function (value, index, array) {
                var oldTarget;
    
                if (arena.timers.mobTimer % value.cooldown === 0) {
                    /* curr.maxAttacksOnTarget attacks on target = max */
                    if (!value.memory.target || value.memory.targetAttacks === value.maxAttacksOnTarget) {
                        oldTarget = value.memory.target;
    
                        value.memory.target = sys.name(players[Math.floor(Math.random() * players.length)]);
    
                        if (value.memory.target === oldTarget) {
                            return; // Skip
                        } else {
                            value.memory.targetAttacks = 0;
                        }
                    }
    
                    ++value.memory.targetAttacks;
    
                    array[index] = value;
    
                    arena.battle({
                        attacker: value.name,
                        target: value.memory.target,
                        byMob: true,
                        toMob: false
                    });
                }
            });
            
            return; // Can't spawn/attack if there are less than 3 players in the channel.
        }

        arena.timers.mobTimer++;

        arena.mobPokemons.forEach(function (value, index, array) {
            var group;

            if (stop) {
                return;
            }

            group = arena.mobGroups[value.group];

            if (arena.mobIndex(value.name) !== -1) {
                return; // We don't want mob dupes.
            }

            if (arena.timers.mobTimer % group.timeout === 0 && group.chance >= Math.random()) {
                arena.spawnMob(value.name);

                if (players.length < 15) {
                    stop = true; // We don't want a ton of spawns if there are less than 15 people
                }
            }
        });

        players = players.filter(function (value, index, array) {
            return !arena.testDead(arena.players[sys.name(value).toLowerCase()] || {dead: false}).dead;
        }); // filter out any dead players

        if (players.length === 0) {
            return; // Can't attack dead players!
        }

        arena.mobs.forEach(function (value, index, array) {
            var oldTarget;

            if (arena.timers.mobTimer % value.cooldown === 0) {
                /* curr.maxAttacksOnTarget attacks on target = max */
                if (!value.memory.target || value.memory.targetAttacks === value.maxAttacksOnTarget) {
                    oldTarget = value.memory.target;

                    value.memory.target = sys.name(players[Math.floor(Math.random() * players.length)]);

                    if (value.memory.target === oldTarget) {
                        return; // Skip
                    } else {
                        value.memory.targetAttacks = 0;
                    }
                }

                ++value.memory.targetAttacks;

                array[index] = value;

                arena.battle({
                    attacker: value.name,
                    target: value.memory.target,
                    byMob: true,
                    toMob: false
                });
            }
        });
    },
    afterLogIn: function (src) {
        arena.send(src,
            "Welcome, " + arena.util.player.player(src) + "! Start playing by going to <a href='po:join/" + arena.channelName + "'>#" + arena.channelName + "</a>!"
            );
    },
    afterChannelJoin: function (src, chan) {
        var name = sys.name(src).toLowerCase(),
            first;

        if (chan !== arena.chan) {
            return;
        }

        if (Object.has(arena.players, name)) {
            arena.send(src,
                "Welcome back, " + arena.util.player.player(src) + "! You are a(n) " + arena.players[name].name + ". Type \"commands\" (without the quotes) to begin!",
                chan);
        } else {
            first = Object.extend({}, arena.playerPokemons[0]);
            arena.players[name] = first;

            arena.send(src,
                "Welcome, " + arena.util.player.player(src) + ", to Battle Arena! You start out as a " + first.name + ". Type \"commands\" (without the quotes) to begin!",
                chan);
        }
    },
    beforeChatMessage: function (src, message, chan) {
        var data,
            command,
            dcmd,
            mcmd;

        if (chan !== arena.chan) {
            return;
        }

        data = message.split(" ");
        command = data.splice(0, 1)[0].toLowerCase();
        dcmd = data.join(" ");
        mcmd = dcmd.split(":");

        if (arena.commands[command]) {
            try {
                arena.commands[command](src, dcmd, mcmd);
            } catch (e) {
                sys.sendAll("Error in Battle Arena command '" + command + "': " + e + " on line " + e.lineNumber);
                
                if (e.backtracetext) {
                    print("Backtrace:");
                    print(e.backtracetext);
                }
            }
            
            return sys.stopEvent();
        }
    },
    beforeChannelDestroyed: function (chan) {
        if (chan === arena.chan) {
            return sys.stopEvent();
        }
    },
    serverShutDown: function () {
        arena.util.json.write(arena.dataFile, arena.players);
    }
});
