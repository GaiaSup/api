#!/usr/bin/env python
# coding: utf-8

import time
from pyGaia.gaiasup import *
gs = GaiaSup()

# Initial position
POS_X = 220
POS_Y = 120
POS_Z = 3

# Query range
QS_RANGE = 50

# FILL THIS: Your ident, e.g. name for node/user
IDENT = ''

# FILL THIS: Your API key
API_KEY = ''

# FILL THIS: Layer for node can be join
LAYER = ''

try:
  print '== join: ' + str(gs.join(API_KEY, LAYER, IDENT))

  for i in range(120,300,5):
    POS_X = i
    POS_Y = i+10
    print '== publishPos: ' + str(gs.publishPos(POS_X, POS_Y, POS_Z))

    print '== querySquare: (' + str(POS_X-QS_RANGE) + ' to ' + str(POS_X+QS_RANGE) + ', ' + str(POS_Y-QS_RANGE) + ' to ' + str(POS_Y+QS_RANGE) + ', ' + str(POS_Z) + ')'
    retQS = gs.querySquare(POS_X-QS_RANGE, POS_Y-QS_RANGE, 3, POS_X+QS_RANGE, POS_Y+QS_RANGE, POS_Z)
    for j in range(len(retQS[0])):
      uni = retQS[0][j]['ident']
      print '= [' + str(j) + ']: ' + uni.encode('utf-8', 'ignore')

    time.sleep(1)

  qStr = '[{"apikey": "ff003eee35778519ff3dee61ae91833233d0e8a8", "layer": "coscup2012", "ident": "mrmoneyc" }]'
  print '== queryNode(Single): ' + str(gs.queryNode('', API_KEY, LAYER, 'mrmoneyc'))
  print '== queryNode(Multiple): ' + str(gs.queryNode(qStr))

  print '== subscribeNode(Single): ' + str(gs.subscribeNode('', API_KEY, LAYER, 'mrmoneyc'))
  print '== subscribeNode(Multiple): ' + str(gs.subscribeNode(qStr))

  print '== getSubscribers(Self): ' + str(gs.getSubscribers())
  print '== getSubscribers(Other): ' + str(gs.getSubscribers(API_KEY, LAYER, 'mrmoneyc'))

  sndMsgS = '{"msg": "This is Python Lib 測試 for Single"}'
  sndMsgM = '{"msg": "This is Python Lib 測試 for Multiple", "to": [{"apikey": "ff003eee35778519ff3dee61ae91833233d0e8a8", "layer": "coscup2012", "ident": "' + IDENT + '"}]}'
  print '== sendMessage(Single): ' + str(gs.sendMessage(sndMsgS, API_KEY, LAYER, IDENT))
  time.sleep(2)
  startTime = time.time()
  print '== sendMessage(Multiple): ' + str(gs.sendMessage(sndMsgM))

  print '== receiveMessage: ' + str(gs.receiveMessage())

  stopTime = time.time()
  print '== queryMessage: ' + str(gs.queryMessage(startTime, stopTime))

  print '== revokeNode: ' + str(gs.revokeNode())

  print '== revokeLayer: ' + str(gs.revokeLayer(API_KEY, LAYER))
except:
  gs.revokeNode()
  gs.revokeLayer(API_KEY, LAYER)
