// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * Campaign 3 (Khe Sanh) - US Scenario Narrative Scene Graph
 * 
 * An intense, continuous 1-hour slice of combat on the morning of Jan 20th.
 * Focuses entirely on holding Hill 881 South against a dawn sapper probe and mortar attack.
 * Maintains strict spatial and chronological continuity between scenes.
 * Utilizes OOP event triggers (STAT_CHANGED, CASUALTY_TAKEN) and soldier survival requirements.
 */
export const campaign3US = {
  start: {
    location: "Hill 881 South, Outpost Bunker 4 - 0530 Hrs",
    mapX: 50,
    mapY: 50,
    weather: "Fog",
    narrative: "Dense, wool-white fog clings to the jagged slopes of Hill 881 South. The red laterite clay beneath your jungle boots has the consistency of wet lard. Your squad has been holding perimeter trench Bunker 4 for seventy-two sleepless hours. Below, thirty meters down the slope, the bamboo canopy trembles in the still morning air. The wind shifts, carrying the unmistakable scent of woodsmoke and cheap Vietnamese tobacco. Over the PRC-25 radio, Battalion static crackles: 'India Six, report suspicious movement on the ridgeline.'",
    choices: [
      {
        id: "start_send_duke",
        text: "Order CPL Brady to unleash Duke to silently scent the woodline edge just past the wire.",
        resolutionText: "CPL Brady unclips Duke's leash and points toward the concertina wire. The German Shepherd slips silently over the sandbags into the thick mist, sniffing the humid air. Seconds later, a low, rumbling growl echoes back.",
        nextScene: "mist_patrol_duke",
        requirements: {
          alive: "duke"
        },
        events: [
          {
            type: "RADIO_MESSAGE_RECEIVED",
            payload: { channel: "HQ", callsign: "India Six", text: "India Six to Whiskey One: report suspicious movement along Grid 881 ridgeline.", sender: "India Six" }
          },
          {
            type: "STAT_CHANGED",
            payload: { intel: 15, heat: 5, supplies: -5 }
          }
        ]
      },
      {
        id: "start_recon_patrol",
        text: "Dispatch Point Man Jenkins to quietly slip out of the trench and probe the slope.",
        resolutionText: "Jenkins nods, checks his M16, and hoists himself over the trench parapet. He creeps forward along the muddy spur, disappearing into the fog. Thirty seconds later, the sharp click of a tripwire freezing mechanism snaps through the silence.",
        nextScene: "woodline_probe",
        requirements: {
          alive: "jenkins"
        },
        events: [
          {
            type: "RADIO_MESSAGE_RECEIVED",
            payload: { channel: "HQ", callsign: "India Six", text: "India Six to Whiskey One: report suspicious movement along Grid 881 ridgeline.", sender: "India Six" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 15, intel: 10, supplies: -10 }
          }
        ]
      },
      {
        id: "start_call_barrage",
        text: "Have Radio Operator Thompson call in a pre-emptive 105mm illumination and HE barrage on the woodline.",
        resolutionText: "Thompson barks target coordinates into the handset. Within seconds, the shriek of incoming 105mm shells tears the sky. The valley floor erupts in blinding flashes, violently illuminating silhouettes moving toward your bunker.",
        nextScene: "hill_barrage_called",
        requirements: {
          alive: "thompson"
        },
        events: [
          {
            type: "RADIO_MESSAGE_RECEIVED",
            payload: { channel: "HQ", callsign: "India Six", text: "India Six to Whiskey One: report suspicious movement along Grid 881 ridgeline.", sender: "India Six" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 25, supplies: -20, intel: 5 }
          }
        ]
      }
    ]
  },

  mist_patrol_duke: {
    location: "Concertina Wire Perimeter - 0532 Hrs",
    mapX: 50,
    mapY: 50,
    detachment: { name: "Duke", mapX: 55, mapY: 45 },
    narrative: "You follow Duke's growl, crouching at the edge of the concertina wire. Through the parted fog, Brady spots three NVA sappers in loincloths, covered in mud, quietly snipping the final strand of barbed wire just fifteen meters from Bunker 4. They are carrying bamboo bangalore torpedoes, preparing to blow a gap for the main assault force.",
    choices: [
      {
        id: "duke_track_scent",
        text: "Order Brady and Duke to silently track the sappers' scent trail through the damp mist.",
        resolutionText: "Duke stays low to the mud, tracking the scent trail directly to the enemy infiltration line. Duke's acute senses awaken his dormant Jungle Hunter instincts.",
        nextScene: "sapper_contact",
        requirements: {
          alive: "duke"
        },
        events: [
          {
            type: "TRAIT_DISCOVERED",
            payload: {
              soldierId: "brady",
              trait: "Jungle Hunter",
              reason: "Tracked NVA sapper infiltration scent through morning mist with Duke."
            }
          },
          {
            type: "STAT_CHANGED",
            payload: { intel: 20, heat: 5 }
          }
        ]
      },
      {
        id: "duke_flank_assault",
        text: "Signal Brady and Duke to rush the sappers with cold steel before they can trigger the explosives.",
        resolutionText: "Brady pats Duke's flank and surges forward. The dog leaps over the snipped wire, tearing into the lead sapper. Brady follows up with a fixed bayonet, neutralizing the immediate threat in seconds.",
        nextScene: "sapper_contact",
        requirements: {
          alive: "brady"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { intel: 10, heat: 10 }
          }
        ]
      },
      {
        id: "duke_grenade_ambush",
        text: "Have Grenadier Washington lob an M79 buckshot canister directly into the sapper team.",
        resolutionText: "Washington pops up, snaps his M79 barrel shut, and fires a 40mm buckshot round point-blank. The metallic thump is followed by a devastating blast that shreds the sappers and their explosives.",
        nextScene: "sapper_contact",
        requirements: {
          alive: "washington"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 25, intel: 5, supplies: -10 }
          }
        ]
      }
    ]
  },

  woodline_probe: {
    location: "Muddy Spur outside Bunker 4 - 0532 Hrs",
    mapX: 50,
    mapY: 50,
    detachment: { name: "Jenkins", mapX: 60, mapY: 45 },
    narrative: "Jenkins is frozen in the mud, foot hovering inches above a taut monofilament wire. Ahead, a camouflaged NVA spider hole is dug into the red clay. Through the dense bamboo ahead, shadows detach themselves from the fog. An NVA sapper team realizes Jenkins has spotted them and raises their AK-47s to fire.",
    choices: [
      {
        id: "woodline_probe_spider_hole",
        text: "Order Jenkins to crawl directly into the narrow spider hole to cut the booby trap wire and probe the subterranean redoubt.",
        resolutionText: "Jenkins squeezes into the suffocating, pitch-black spider hole. The claustrophobic darkness and damp earth pressing on his ribs induce an acute panic attack.",
        nextScene: "sapper_contact",
        requirements: {
          alive: "jenkins"
        },
        events: [
          {
            type: "TRAIT_DISCOVERED",
            payload: {
              soldierId: "jenkins",
              trait: "Claustrophobic",
              reason: "Suffocating terror entering confined underground spider hole."
            }
          },
          {
            type: "STAT_CHANGED",
            payload: { stress: 15, intel: 15 }
          }
        ]
      },
      {
        id: "woodline_medic_lifesaver",
        text: "Doc Baker crawls forward under fire to bandage Jenkins's arm and drag him clear with combat lifesaver skills.",
        resolutionText: "Doc Baker ignores snapping AK rounds, applying a rapid pressure dressing and dragging Jenkins clear with combat lifesaver precision.",
        nextScene: "sapper_contact",
        requirements: {
          alive: "baker"
        },
        events: [
          {
            type: "TRAIT_DISCOVERED",
            payload: {
              soldierId: "baker",
              trait: "Combat Lifesaver",
              reason: "Stabilized an exposed casualty under close fire."
            }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 15, supplies: -10 }
          }
        ]
      },
      {
        id: "woodline_kowalski_cover",
        text: "Yell for Kowalski to lay down covering fire from Bunker 4 so Jenkins can dive back to the trench.",
        resolutionText: "You scream the order. Kowalski drops his M60 onto the sandbags and dumps a long, roaring burst into the bamboo. Tracers chew the foliage, allowing Jenkins to throw himself backward into the mud and scramble toward the wire.",
        nextScene: "sapper_contact",
        requirements: {
          alive: "kowalski"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 25, supplies: -20 }
          }
        ]
      },
      {
        id: "woodline_medic_smoke",
        text: "Doc Baker hurls a violet smoke grenade to conceal Jenkins as the enemy opens fire.",
        resolutionText: "Doc Baker chunks an M18 violet smoke grenade over the parapet. It lands near Jenkins, spewing a thick purple cloud just as the AKs erupt. Jenkins rolls blindly through the colored smoke back toward your lines.",
        nextScene: "sapper_contact",
        requirements: {
          alive: "baker"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 20, supplies: -15 }
          }
        ]
      }
    ]
  },

  hill_barrage_called: {
    location: "Outpost Bunker 4 Roof - 0533 Hrs",
    mapX: 50,
    mapY: 55,
    narrative: "The 105mm barrage slams into the tree line below, sending geysers of mud and shattered bamboo into the air. In the strobing light of the explosions, you see a horrifying sight: dozens of NVA regulars had already crawled past the barrage line and are sprinting up the final thirty meters toward your trench, screaming.",
    choices: [
      {
        id: "barrage_manning_wall",
        text: "Order the entire squad to the firing step to repel the charge with sustained small arms fire.",
        resolutionText: "You kick the men onto the firing step. M16s and the M60 erupt in a continuous, deafening roar, cutting down the first wave of attackers as they hit the concertina wire.",
        nextScene: "trench_defense",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 30, supplies: -30 }
          }
        ]
      },
      {
        id: "barrage_claymores",
        text: "Hit the 'clackers' to detonate the defensive Claymore perimeter.",
        resolutionText: "You squeeze the firing devices. A wave of C-4 and steel ball bearings blasts outward from the wire line, instantly vaporizing the lead elements of the charge in a cloud of red mist.",
        nextScene: "trench_defense",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 40, supplies: -20 }
          }
        ]
      }
    ]
  },

  sapper_contact: {
    location: "Concertina Wire Perimeter - 0534 Hrs",
    mapX: 60,
    mapY: 50,
    narrative: "A concealed bamboo sapper satchel charge detonates with an ear-splitting CRACK! The blast flings jagged steel shrapnel across the wire line. SP4 Torres is thrown violently backward into the mud, clutching his shredded leg in agony. Shrill whistles pierce the fog as the main NVA assault force charges up the slope.",
    choices: [
      {
        id: "contact_fall_back",
        text: "Order an immediate fighting withdrawal back over the parapet into Bunker 4 while Torres is carried.",
        resolutionText: "Firing from the hip, you and your men scramble backward, tumbling over the wet sandbags into the deep trench just as RPGs slam into the exterior wall. Torres is bleeding severely from shrapnel lacerations.",
        nextScene: "trench_defense",
        requirements: {},
        events: [
          {
            type: "SOLDIER_WOUNDED",
            payload: {
              soldierId: "torres",
              severity: "severe",
              details: { wound: "Severe blast lacerations and shrapnel to leg from sapper satchel charge", bleedoutTimer: 2 }
            }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 20, supplies: -10 }
          }
        ]
      },
      {
        id: "contact_forward_push",
        text: "Charge forward into the nearby mortar crater to establish a forward fighting position.",
        resolutionText: "Screaming a battle cry, you lead the element in a mad dash forward. You slide into a massive, muddy crater just as the enemy vanguard reaches the wire behind you. Torres is severely wounded behind the wire.",
        nextScene: "forward_push",
        requirements: {},
        events: [
          {
            type: "SOLDIER_WOUNDED",
            payload: {
              soldierId: "torres",
              severity: "severe",
              details: { wound: "Severe blast lacerations and shrapnel to leg from sapper satchel charge", bleedoutTimer: 2 }
            }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 35, intel: 15, supplies: -15 }
          }
        ]
      }
    ]
  },

  trench_defense: {
    location: "Inside Bunker 4 Trench - 0536 Hrs",
    mapX: 50,
    mapY: 50,
    narrative: "You are shoulder-to-shoulder in the mud of the trench. The enemy is right on top of the bunker. AK-47 fire chips away the sandbags inches from your face. Torres is bleeding out at the bottom of the trench, his blood mixing with the red clay water. Command triage decisions must be made under fire.",
    choices: [
      {
        id: "triage_carry_torres",
        text: "Carry Torres to Bunker: Assign Kowalski as carrier to shield him from fire (Incurs mobility & firepower penalty).",
        resolutionText: "Kowalski slings his M60 over his shoulder and hoists Torres onto his back, carrying him into the fortified bunker. Kowalski's firepower is tied up, but Torres's life is preserved.",
        nextScene: "line_held",
        woundedDecision: { action: "carry", woundedId: "torres", carrierId: "kowalski" },
        requirements: { alive: "kowalski" },
        events: [
          {
            type: "WOUNDED_DECISION_MADE",
            payload: { action: "carry", woundedId: "torres", carrierId: "kowalski" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 10 }
          }
        ]
      },
      {
        id: "triage_stabilize_torres",
        text: "Doc Baker Field Stabilize: Doc Baker administers plasma in trench under fire (Chance for Silver Star).",
        resolutionText: "Doc Baker drops to his knees in the red mud. Under a hail of AK-47 fire, he hooks up a plasma bottle and clamps the bleeding artery, stabilizing Torres's condition and earning a Silver Star recommendation.",
        nextScene: "line_held",
        woundedDecision: { action: "stabilize", woundedId: "torres", medicId: "baker" },
        requirements: { alive: "baker" },
        events: [
          {
            type: "WOUNDED_DECISION_MADE",
            payload: { action: "stabilize", woundedId: "torres", medicId: "baker" }
          },
          {
            type: "HEROIC_ACTION",
            payload: {
              soldierId: "baker",
              action: "Doc Baker Field Stabilize",
              medal: "Silver Star",
              citation: "Administered life-saving plasma in trench under relentless enemy fire."
            }
          },
          {
            type: "STAT_CHANGED",
            payload: { supplies: -15, heat: 5 }
          }
        ]
      },
      {
        id: "triage_dustoff_torres",
        text: "Radio Dustoff Medevac: Thompson calls 52.00 MHz for emergency air evacuation (Spikes Heat +25).",
        resolutionText: "Thompson barks into the PRC-25 handset on 52.00 MHz. Dustoff 2-1 acknowledges, banking through the fog. The roar of rotors attracts intense NVA mortar fire, spiking sector heat by +25.",
        nextScene: "line_held",
        woundedDecision: { action: "medevac", woundedId: "torres", lzStatus: "hot" },
        requirements: { alive: "thompson" },
        events: [
          {
            type: "WOUNDED_DECISION_MADE",
            payload: { action: "medevac", woundedId: "torres" }
          },
          {
            type: "SOLDIER_EVACUATED",
            payload: { soldierId: "torres" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 25 }
          },
          {
            type: "RADIO_MESSAGE_RECEIVED",
            payload: { channel: "Medevac", callsign: "Dustoff 2-1", text: "Dustoff 2-1 inbound 52.00 MHz. Popping green smoke. Secure that trench!", sender: "Dustoff 2-1" }
          }
        ]
      },
      {
        id: "triage_abandon_torres",
        text: "Leave Wounded in Trench: Leave Torres behind to keep all rifles on the firing step (Severe moral penalty).",
        resolutionText: "You grimly order the squad to leave Torres in the trench sump and maintain maximum firepower on the line. Torres screams in betrayal. The decision inflicts devastating psychological trauma and Survivor's Guilt.",
        nextScene: "line_held",
        woundedDecision: { action: "abandon", woundedId: "torres", reason: "Abandoned in Bunker 4 trench" },
        requirements: {},
        events: [
          {
            type: "SOLDIER_ABANDONED",
            payload: { soldierId: "torres", reason: "Abandoned in Bunker 4 trench" }
          },
          {
            type: "STAT_CHANGED",
            payload: { stress: 35, heat: -10 }
          },
          {
            type: "CONDITION_GAINED",
            payload: { soldierId: "miller", condition: "Survivor's Guilt" }
          }
        ]
      },
      {
        id: "defense_kick_charge",
        text: "Kick an incoming satchel charge into the drainage sump before it detonates.",
        resolutionText: "You lunge forward, booting the canvas bag into the deep water sump. The explosion sends a geyser of filthy water into the air, sparing the squad but collapsing the right wall of the trench.",
        nextScene: "line_held",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 20, supplies: -5 }
          }
        ]
      }
    ]
  },

  forward_push: {
    location: "Crater Forward Position - 0536 Hrs",
    mapX: 65,
    mapY: 55,
    narrative: "You are pinned in the crater, fifteen meters ahead of Bunker 4. The NVA charge has bypassed you, swarming toward the main trench line. You are perfectly positioned to hit them in the flank, but an enemy RPD machine gunner in the bamboo has you zeroed, pinning your heads down.",
    choices: [
      {
        id: "push_jungle_ghost",
        text: "[JUNGLE GHOST] Infiltrate through the bamboo drainage ditch completely undetected.",
        resolutionText: "Using the thick morning mist and low drainage culvert, you move like phantoms, bypassing the NVA flank without alerting a single enemy sentry.",
        nextScene: "enemy_flank",
        requirements: {
          reputation: "Jungle Ghost"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -20, intel: 20 }
          }
        ]
      },
      {
        id: "push_aggressive",
        text: "[AGGRESSIVE] Call in 155mm Howitzer danger-close barrage on treeline.",
        resolutionText: "You unleash hell. 155mm high-explosive rounds pulverize the treeline sixty meters out, shredding the bamboo and annihilating the enemy assault force.",
        nextScene: "enemy_flank",
        requirements: {
          reputation: "Aggressive"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 35, supplies: -25 }
          }
        ]
      },
      {
        id: "push_tactical",
        text: "[TACTICAL] Coordinate overlapping fire between Kowalski's M60 and Brady's K-9 perimeter.",
        resolutionText: "With textbook tactical discipline, Kowalski lays grazing fire across the slope while Brady and Duke pin down the flanks, creating a lethal interlocking crossfire.",
        nextScene: "enemy_flank",
        requirements: {
          reputation: "Tactical",
          alive: "kowalski"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -10, intel: 15, supplies: -10 }
          }
        ]
      },
      {
        id: "push_protector",
        text: "[PROTECTOR] Form a defensive shield around the wounded while holding Bunker 4.",
        resolutionText: "You position your healthiest riflemen in a defensive circle around the wounded, refusing to yield an inch of ground and fortifying squad trust.",
        nextScene: "enemy_flank",
        requirements: {
          reputation: "Protector"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 10, stress: -15 }
          }
        ]
      },
      {
        id: "push_m79_flank",
        text: "Have Washington arc an M79 grenade over the crater lip to silence the RPD.",
        resolutionText: "Washington aims blindly using the trajectory arc and fires. The grenade detonates in the bamboo canopy, raining shrapnel down on the gunner and silencing the weapon.",
        nextScene: "enemy_flank",
        requirements: {
          alive: "washington"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -10, intel: 10, supplies: -5 }
          }
        ]
      },
      {
        id: "push_duke_distract",
        text: "Send Duke to flank the machine gunner through the tall elephant grass.",
        resolutionText: "Duke darts out of the crater. Seconds later, screams erupt from the bamboo as the dog hits the gunner, breaking his focus and allowing you to pop up.",
        nextScene: "enemy_flank",
        requirements: {
          alive: "duke"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -5, intel: 15 }
          }
        ]
      }
    ]
  },

  bunker_breach: {
    location: "Ruined Bunker 4 - 0538 Hrs",
    mapX: 50,
    mapY: 50,
    narrative: "The bunker roof has partially collapsed. Dust and cordite choke the air. Through the smoking breach, three NVA regulars drop into the trench line with fixed bayonets. It's point-blank, close-quarters combat.",
    choices: [
      {
        id: "breach_melee",
        text: "Draw your entrenching tool and engage in brutal hand-to-hand combat.",
        resolutionText: "You swing the sharpened edge of your e-tool in a desperate arc, colliding with the lead attacker. The trench devolves into a bloody, desperate wrestling match in the mud.",
        nextScene: "close_quarters_trench",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 40, supplies: -5 }
          }
        ]
      },
      {
        id: "breach_jenkins_shotgun",
        text: "Jenkins pumps his trench shotgun, clearing the breach with sheer firepower.",
        resolutionText: "Jenkins racks a 12-gauge shell and fires from the hip. The blast throws the attackers violently backward, clearing the immediate breach but leaving the squad exposed.",
        nextScene: "close_quarters_trench",
        requirements: {
          alive: "jenkins"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 25, supplies: -15 }
          }
        ]
      }
    ]
  },

  line_held: {
    location: "Bunker 4 Firing Bay - 0540 Hrs",
    mapX: 50,
    mapY: 50,
    narrative: "You've repelled the immediate infantry push, but the enemy has fallen back to the woodline. The eerie whistle of incoming 82mm mortars begins. They are trying to blast you out of the trench before the next wave.",
    choices: [
      {
        id: "held_hunker_down",
        text: "Cram the squad under the reinforced timber supports and wait out the barrage.",
        resolutionText: "You dive under the heavy oak beams. Explosions walk up the slope, shaking the earth and dropping dirt into your collars, but the timber holds.",
        nextScene: "mortar_barrage",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 10, supplies: -5 }
          }
        ]
      },
      {
        id: "held_call_counter_battery",
        text: "Have Thompson radio coordinates to Khe Sanh Combat Base for counter-battery fire.",
        resolutionText: "Thompson yells coordinates into the handset. Minutes later, the heavy boom of friendly 155mm artillery echoes from the main base, silencing the enemy tubes.",
        nextScene: "mortar_barrage",
        requirements: {
          alive: "thompson"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -10, intel: 15, supplies: -15 }
          }
        ]
      }
    ]
  },

  enemy_flank: {
    location: "Enemy Flank (Outside Wire) - 0542 Hrs",
    mapX: 70,
    mapY: 60,
    narrative: "From your forward crater, you open fire on the exposed backs of the NVA assault force attacking Bunker 4. Caught in a deadly crossfire between your squad and the trench, the enemy assault stalls. However, an enemy RPG gunner spots your position and aims his tube directly at your crater.",
    choices: [
      {
        id: "flank_jungle_ghost",
        text: "[JUNGLE GHOST] Infiltrate through the bamboo drainage ditch completely undetected.",
        resolutionText: "Using the thick morning mist and low drainage culvert, you move like phantoms, bypassing the NVA flank without alerting a single enemy sentry.",
        nextScene: "dawn_repulse",
        requirements: {
          reputation: "Jungle Ghost"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -20, intel: 20 }
          }
        ]
      },
      {
        id: "flank_aggressive",
        text: "[AGGRESSIVE] Call in 155mm Howitzer danger-close barrage on treeline.",
        resolutionText: "You unleash hell. 155mm high-explosive rounds pulverize the treeline sixty meters out, shredding the bamboo and annihilating the enemy assault force.",
        nextScene: "dawn_repulse",
        requirements: {
          reputation: "Aggressive"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 35, supplies: -25 }
          }
        ]
      },
      {
        id: "flank_tactical",
        text: "[TACTICAL] Coordinate overlapping fire between Kowalski's M60 and Brady's K-9 perimeter.",
        resolutionText: "With textbook tactical discipline, Kowalski lays grazing fire across the slope while Brady and Duke pin down the flanks, creating a lethal interlocking crossfire.",
        nextScene: "dawn_repulse",
        requirements: {
          reputation: "Tactical",
          alive: "kowalski"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -10, intel: 15, supplies: -10 }
          }
        ]
      },
      {
        id: "flank_protector",
        text: "[PROTECTOR] Form a defensive shield around the wounded while holding Bunker 4.",
        resolutionText: "You position your healthiest riflemen in a defensive circle around the wounded, refusing to yield an inch of ground and fortifying squad trust.",
        nextScene: "dawn_repulse",
        requirements: {
          reputation: "Protector"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 10, stress: -15 }
          }
        ]
      },
      {
        id: "flank_snipe_rpg",
        text: "Take a steady breath and try to drop the RPG gunner with your M16 before he fires.",
        resolutionText: "You squeeze the trigger. The 5.56mm round takes the gunner in the shoulder. His rocket fires wild, streaking harmlessly into the sky above the hill.",
        nextScene: "dawn_repulse",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -15, supplies: -5 }
          }
        ]
      },
      {
        id: "flank_kowalski_suppress",
        text: "Order Kowalski to rip the RPG gunner apart with the M60.",
        resolutionText: "Kowalski doesn't hesitate. A sustained burst of 7.62mm tears the gunner apart, detonating the rocket warhead on his back and neutralizing the entire fire team.",
        nextScene: "dawn_repulse",
        requirements: {
          alive: "kowalski"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 5, supplies: -20 }
          }
        ]
      }
    ]
  },

  close_quarters_trench: {
    location: "Bunker 4 Communications Trench - 0545 Hrs",
    mapX: 45,
    mapY: 50,
    narrative: "The trench is secured, but at a heavy cost. SP4 Torres is bleeding badly from a shrapnel wound to the leg, and the hardline comms wire connecting you to the platoon command post has been severed in the blast. You are isolated and taking casualties under continuous mortar fire.",
    choices: [
      {
        id: "cqc_carry_torres",
        text: "Carry Torres to Bunker: Assign Kowalski as carrier to shield him from fire (Incurs mobility & firepower penalty).",
        resolutionText: "Kowalski slings his M60 over his shoulder and hoists Torres onto his back, carrying him into the fortified bunker. Kowalski's firepower is tied up, but Torres's life is preserved.",
        nextScene: "mortar_barrage",
        woundedDecision: { action: "carry", woundedId: "torres", carrierId: "kowalski" },
        requirements: { alive: "kowalski" },
        events: [
          {
            type: "WOUNDED_DECISION_MADE",
            payload: { action: "carry", woundedId: "torres", carrierId: "kowalski" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 10 }
          }
        ]
      },
      {
        id: "cqc_stabilize_torres",
        text: "Doc Baker Field Stabilize: Doc Baker administers plasma in trench under fire (Chance for Silver Star).",
        resolutionText: "Doc Baker drops to his knees in the red mud. Under a hail of AK-47 fire, he hooks up a plasma bottle and clamps the bleeding artery, stabilizing Torres's condition and earning a Silver Star recommendation.",
        nextScene: "mortar_barrage",
        woundedDecision: { action: "stabilize", woundedId: "torres", medicId: "baker" },
        requirements: { alive: "baker" },
        events: [
          {
            type: "WOUNDED_DECISION_MADE",
            payload: { action: "stabilize", woundedId: "torres", medicId: "baker" }
          },
          {
            type: "HEROIC_ACTION",
            payload: {
              soldierId: "baker",
              action: "Doc Baker Field Stabilize",
              medal: "Silver Star",
              citation: "Administered life-saving plasma in trench under relentless enemy fire."
            }
          },
          {
            type: "STAT_CHANGED",
            payload: { supplies: -15, heat: 5 }
          }
        ]
      },
      {
        id: "cqc_dustoff_torres",
        text: "Radio Dustoff Medevac: Thompson calls 52.00 MHz for emergency air evacuation (Spikes Heat +25).",
        resolutionText: "Thompson barks into the PRC-25 handset on 52.00 MHz. Dustoff 2-1 acknowledges, banking through the fog. The roar of rotors attracts intense NVA mortar fire, spiking sector heat by +25.",
        nextScene: "mortar_barrage",
        woundedDecision: { action: "medevac", woundedId: "torres", lzStatus: "hot" },
        requirements: { alive: "thompson" },
        events: [
          {
            type: "WOUNDED_DECISION_MADE",
            payload: { action: "medevac", woundedId: "torres" }
          },
          {
            type: "SOLDIER_EVACUATED",
            payload: { soldierId: "torres" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: 25 }
          },
          {
            type: "RADIO_MESSAGE_RECEIVED",
            payload: { channel: "Medevac", callsign: "Dustoff 2-1", text: "Dustoff 2-1 inbound 52.00 MHz. Popping green smoke. Secure that trench!", sender: "Dustoff 2-1" }
          }
        ]
      },
      {
        id: "cqc_abandon_torres",
        text: "Leave Wounded in Trench: Leave Torres behind to keep all rifles on the firing step (Severe moral penalty).",
        resolutionText: "You grimly order the squad to leave Torres in the trench sump and maintain maximum firepower on the line. Torres screams in betrayal. The decision inflicts devastating psychological trauma and Survivor's Guilt.",
        nextScene: "mortar_barrage",
        woundedDecision: { action: "abandon", woundedId: "torres", reason: "Abandoned in Bunker 4 trench" },
        requirements: {},
        events: [
          {
            type: "SOLDIER_ABANDONED",
            payload: { soldierId: "torres", reason: "Abandoned in Bunker 4 trench" }
          },
          {
            type: "STAT_CHANGED",
            payload: { stress: 35, heat: -10 }
          },
          {
            type: "CONDITION_GAINED",
            payload: { soldierId: "miller", condition: "Survivor's Guilt" }
          }
        ]
      },
      {
        id: "cqc_medic_triage",
        text: "Have Doc Baker apply a tourniquet and stabilize Torres in the mud.",
        resolutionText: "Doc Baker rips open his aid bag, slapping a dressing on Torres's leg and twisting a tourniquet tight, stemming the arterial flow while bullets snap overhead.",
        nextScene: "medevac_trench",
        requirements: {
          alive: "baker"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -5, supplies: -15 }
          }
        ]
      },
      {
        id: "cqc_fix_wire",
        text: "Leave the wounded for a moment and sprint down the trench to splice the comms wire.",
        resolutionText: "You low-crawl through the muddy water, find the frayed ends of the comm wire, and furiously strip them with your teeth, twisting them together to restore the line.",
        nextScene: "wire_repair",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { intel: 20, heat: 15 }
          }
        ]
      }
    ]
  },

  mortar_barrage: {
    location: "Bunker 4 Rear Defilade - 0548 Hrs",
    mapX: 45,
    mapY: 55,
    weather: "Heavy Rain",
    narrative: "The enemy mortars hammer the trench line as skies open into a torrential tropical downpour. Heavy rain lashes the red mud, and concussive shockwaves rock the timber beams. The fog has turned into blinding rain. Panic threatens to grip the men unless steeled by cold discipline.",
    choices: [
      {
        id: "mortar_calm_under_fire",
        text: "Stand firm on the parapet with steady aim despite the blinding rain and mortar blasts (Calm Under Fire).",
        resolutionText: "Unshaken by the deafening barrage and torrential downpour, you steady your rifle and maintain disciplined overwatch, keeping the squad from collapsing into panic.",
        nextScene: "dawn_repulse",
        requirements: {
          trait: "Calm Under Fire"
        },
        events: [
          {
            type: "WEATHER_CHANGED",
            payload: { type: "Heavy Rain", name: "Heavy Rain" }
          },
          {
            type: "STAT_CHANGED",
            payload: { stress: -20, supplies: -5 }
          }
        ]
      },
      {
        id: "barrage_rearm",
        text: "Quickly distribute the last of the spare magazines and grenades through the downpour.",
        resolutionText: "You rip open a wooden crate, tossing wet bandoleers and M26 frags to your exhausted men, preparing them for the inevitable final push.",
        nextScene: "dawn_repulse",
        requirements: {},
        events: [
          {
            type: "WEATHER_CHANGED",
            payload: { type: "Heavy Rain", name: "Heavy Rain" }
          },
          {
            type: "STAT_CHANGED",
            payload: { supplies: 25, heat: -10 }
          }
        ]
      },
      {
        id: "barrage_thompson_air",
        text: "Thompson calls in Marine Huey Gunships (Unavailable in Heavy Rain or Monsoon).",
        resolutionText: "Thompson guides the gunships in over the radio. The familiar thwack-thwack-thwack of rotor blades echoes down the valley as the Hueys arrive on station.",
        nextScene: "dawn_repulse",
        requirements: {
          alive: "thompson",
          notWeather: ["Heavy Rain", "Thunderstorm", "Monsoon"]
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { intel: 15, heat: -20, supplies: -5 }
          }
        ]
      }
    ]
  },

  medevac_trench: {
    location: "Medical Sump behind Bunker 4 - 0552 Hrs",
    mapX: 40,
    mapY: 50,
    narrative: "Torres is stable, but the fight isn't over. The NVA are mounting one last desperate charge up the slope, hoping to overrun your weakened position before full daylight exposes them to air strikes. You have to hold the line with a depleted squad.",
    choices: [
      {
        id: "medevac_hold_line",
        text: "Prop Torres up with an M16 and have everyone fire everything they have left.",
        resolutionText: "Every man, wounded or not, rests their rifle on the sandbags. A wall of lead pours down the hill, meeting the advancing enemy head-on.",
        nextScene: "dawn_repulse",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 30, supplies: -25 }
          }
        ]
      }
    ]
  },

  wire_repair: {
    location: "Command Trench Junction - 0555 Hrs",
    mapX: 40,
    mapY: 45,
    narrative: "With comms restored, the Platoon Commander screams over the handset: 'India Six, hold your position! Fast movers are inbound, danger close!' You look up to see the final wave of NVA regulars cresting the ridge, silhouetted against the rising sun.",
    choices: [
      {
        id: "wire_mark_target",
        text: "Throw red smoke directly in front of your trench to mark the target line for the jets.",
        resolutionText: "You pop the pin on a red smoke grenade and heave it over the wall. A thick crimson cloud billows up just as the scream of F-4 Phantoms tears the sky apart.",
        nextScene: "dawn_repulse",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -30, intel: 20, supplies: -10 }
          }
        ]
      }
    ]
  },

  dawn_repulse: {
    location: "Hill 881 South, Outpost Bunker 4 - 0615 Hrs",
    mapX: 50,
    mapY: 50,
    postCombat: true,
    recoveryAvailable: true,
    narrative: "The roar of the jets fades, replaced by the crackle of burning bamboo and the moans of the dying. The morning sun finally breaks through the thinning rain, illuminating a slope littered with bodies. Your squad is exhausted, covered in red clay and sweat, chests heaving. For now, the perimeter holds. Firefight won. Battlefield recovery options are available before withdrawal.",
    choices: [
      {
        id: "dawn_recover_documents",
        text: "Recover Sapper Documents: Inspect enemy commander satchel (+20 Intel, +10 Heat).",
        resolutionText: "You crawl through the wire to the dead sapper leader, cutting free his waterproof leather satchel. Inside are detailed regiment attack routes and bunker coordinates for Hill 881.",
        nextScene: "lz_start",
        recoveryAction: "recover_documents",
        requirements: {},
        events: [
          {
            type: "RECOVERY_OFFERED",
            payload: { context: "dawn_repulse" }
          }
        ]
      },
      {
        id: "dawn_search_ammo",
        text: "Search Bodies for Ammo: Scavenge Type 56 ammo and field dressings (+15 Supplies, +15 Heat).",
        resolutionText: "Your men rapidly comb the wire line, stripping drum magazines, grenades, and clean field dressings from fallen enemy combatants, replenishing depleted ammunition.",
        nextScene: "lz_start",
        recoveryAction: "search_bodies",
        requirements: {},
        events: [
          {
            type: "RECOVERY_OFFERED",
            payload: { context: "dawn_repulse" }
          }
        ]
      },
      {
        id: "dawn_evacuate_fallen",
        text: "Evacuate Fallen Marines: Recover dog tags and fallen comrades under fire (+10 Morale, +25 Heat).",
        resolutionText: "Refusing to leave any American behind, your squad braves sniper fire to retrieve the dog tags and bodies of our fallen brothers. Morale and brotherhood swell, but the delay draws enemy attention.",
        nextScene: "lz_start",
        recoveryAction: "evacuate_fallen",
        requirements: {},
        events: [
          {
            type: "RECOVERY_OFFERED",
            payload: { context: "dawn_repulse" }
          }
        ]
      },
      {
        id: "end_hour",
        text: "Check your weapon, light a cigarette, and prepare for the next 76 days.",
        resolutionText: "You strike a match, hands shaking slightly, and take a deep drag. The smoke burns your lungs, keeping you grounded. You look down the line at your men. The siege has only just begun.",
        nextScene: "lz_start",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -50 }
          }
        ]
      }
    ]
  }
};
